import type { Control, ControlContext, ReadContext } from "@rxc/controls-core";
import {
  type CompoundField,
  coerceForFieldType,
  type ControlDefinition,
  ControlDefinitionSchema,
  ControlDefinitionSchemaMap,
  type EntityExpression,
  hasSchemaTag,
  isCompoundField,
  type SchemaField,
  SchemaTags,
} from "./json";
import {
  createEvalExpr,
  defaultEvaluators,
  type EvalExpr,
  type ExpressionEval,
  type ExpressionEvalContext,
} from "./evalExpression";
import {
  createOverrideProxy,
  type NestedProxyBuilder,
  NoOverride,
} from "./overrideProxy";
import type { DataNode, VariablesFunc } from "./types";
import type { SchemaInterface } from "./schemaInterface";

// ── Schema lookup ─────────────────────────────────────────────────
//
// The scripted-proxy walker traverses the self-describing
// `ControlDefinitionSchema` to discover scriptable fields (coercion,
// `_ScriptNullInit` tagging) and nested compound fields. This means any
// user-extended field declared in `ControlDefinitionSchemaMap` will
// participate in scripting with no additional wiring.

function resolveSchemaRef(ref: string): SchemaField[] | undefined {
  return (ControlDefinitionSchemaMap as Record<string, SchemaField[]>)[ref];
}

function getChildFields(field: CompoundField): SchemaField[] | undefined {
  if (field.schemaRef) {
    const viaRef = resolveSchemaRef(field.schemaRef);
    if (viaRef) return viaRef;
  }
  return field.children;
}

/**
 * Does this subtree have any scripts or `_ScriptNullInit` fields that
 * need an override control? Used to skip materialising override subtrees
 * for compound fields with no scripting — otherwise the parent proxy's
 * `Object.hasOwn(existingFields, X)` check would pick up the empty child
 * control and shadow the base value.
 */
function subtreeHasScripts(
  target: unknown,
  fields: SchemaField[],
  path: string,
  getScripts: ScriptProvider,
): boolean {
  const scripts = getScripts(target, path);
  for (const key of Object.keys(scripts)) {
    if (fields.some((f) => f.field === key)) return true;
  }
  const targetRec = (target ?? undefined) as Record<string, unknown> | undefined;
  for (const field of fields) {
    if (hasSchemaTag(field, SchemaTags.ScriptNullInit)) return true;
    if (!isCompoundField(field) || field.collection) continue;
    const childFields = getChildFields(field);
    if (!childFields?.length) continue;
    const childPath = path ? path + "." + field.field : field.field;
    if (
      subtreeHasScripts(
        targetRec?.[field.field],
        childFields,
        childPath,
        getScripts,
      )
    ) {
      return true;
    }
  }
  return false;
}

// ── Script provider ──────────────────────────────────────────────

/**
 * Resolves the script map for a given object at a given path. The default
 * reads `$scripts` from the target; callers can supply a custom provider
 * to inject legacy `dynamic[]` entries or any other source.
 */
export type ScriptProvider = (
  target: unknown,
  path: string,
) => Record<string, EntityExpression>;

export const defaultScriptProvider: ScriptProvider = (target) =>
  ((target as Record<string, unknown> | null | undefined)?.[
    "$scripts"
  ] as Record<string, EntityExpression>) ?? {};

// ── createEvaluatedDefinition ────────────────────────────────────

/**
 * Options returned by {@link createEvaluatedDefinition} — the caller uses
 * `wrap(rc, base)` inside a reactive read to obtain a definition whose
 * scripted properties resolve through the given {@link ReadContext}.
 *
 * `base` must be a *fresh* definition proxy bound to `rc` — typically
 * obtained via `formNode.cursor(rc).definition`. Reading properties on
 * the returned proxy subscribes through `rc`, so renderer re-renders when
 * non-scripted fields (title, required, etc.) change.
 */
export interface EvaluatedDefinition {
  /** `true` iff any scripted override was registered. */
  hasOverrides: boolean;
  /** Wrap a fresh rc-bound `base` with the override lookups for this node. */
  wrap(rc: ReadContext, base: ControlDefinition): ControlDefinition;
}

/**
 * Build a scripted definition wrapper by walking the
 * `ControlDefinitionSchema` and registering overrides for:
 *
 * 1. Every scriptable field at every level that has a matching entry from
 *    `getScripts(target, path)`.
 * 2. Every `_ScriptNullInit`-tagged field (initialised to {@link NoOverride}
 *    while a script is pending, or the coerced static value when no script
 *    is registered).
 * 3. Non-collection compound children — recursively, with their own
 *    override subtrees allocated under `overridesControl.fields.X`.
 *
 * Collection compound fields (e.g. `adornments`, `validators`) are not
 * traversed for per-element scripting at this layer — no scriptable fields
 * currently live inside arrays on `ControlDefinition`. The extension point
 * is a follow-up.
 */
export function createEvaluatedDefinition(
  def: ControlDefinition,
  ctx: ControlContext,
  dataNode: DataNode,
  schemaInterface: SchemaInterface,
  runAsync: (fn: () => void) => void,
  variables: VariablesFunc | undefined,
  addCleanup: (fn: () => void) => void,
  getScripts: ScriptProvider = defaultScriptProvider,
  /**
   * Extra `SchemaField` entries to append when the walker descends into
   * the `renderOptions` compound. Plugins for custom render types use
   * this to declare scriptable options (e.g. `maxStars`) so scripts on
   * those options register correctly. Fields are appended to the full
   * `RenderOptionsSchema` — `onlyForTypes` on the field controls which
   * render-type discriminators it applies to (filtered downstream).
   */
  extraRenderOptionFields: SchemaField[] = [],
): EvaluatedDefinition {
  const overridesControl = ctx.newControl<Record<string, unknown>>({});

  const dispatch: (
    expr: EntityExpression,
    ec: ExpressionEvalContext,
  ) => void = (expr, ec) => {
    const evaluator: ExpressionEval<any> | undefined =
      defaultEvaluators[expr.type];
    if (!evaluator) return;
    evaluator(expr, ec);
  };

  const evalExpr: EvalExpr = createEvalExpr(dispatch, {
    ctx,
    dataNode,
    schemaInterface,
    variables,
    runAsync,
  });

  const rootBuilders = new Map<string, NestedProxyBuilder>();
  const hasOverrides = buildLevel(
    def,
    ControlDefinitionSchema,
    overridesControl,
    "",
    evalExpr,
    getScripts,
    addCleanup,
    ctx,
    rootBuilders,
    extraRenderOptionFields,
  );

  return {
    hasOverrides,
    wrap(rc: ReadContext, base: ControlDefinition): ControlDefinition {
      if (!hasOverrides) return base;
      return createOverrideProxy(base, overridesControl, rc, rootBuilders);
    },
  };
}

/**
 * Walk one schema level — registers overrides for scriptable and
 * `_ScriptNullInit` fields at this level, then recurses into non-collection
 * compound children. Populates `nestedBuilders` for compounds that had
 * scripts anywhere in their subtree.
 *
 * Returns `true` iff any override was registered at or below this level.
 */
function buildLevel(
  target: unknown,
  fields: SchemaField[],
  overridesControl: Control<Record<string, unknown>>,
  path: string,
  evalExpr: EvalExpr,
  getScripts: ScriptProvider,
  addCleanup: (fn: () => void) => void,
  ctx: ControlContext,
  nestedBuilders: Map<string, NestedProxyBuilder>,
  extraRenderOptionFields: SchemaField[],
): boolean {
  const asRec = (c: Control<unknown>) =>
    c.fields as unknown as Record<string, Control<unknown>>;
  let hasOverrides = false;

  const scripts = getScripts(target, path);
  const targetRec = (target ?? undefined) as Record<string, unknown> | undefined;
  const scriptedKeys = new Set<string>();

  for (const [key, expr] of Object.entries(scripts)) {
    const field = fields.find((f) => f.field === key);
    if (!field) continue;
    scriptedKeys.add(key);
    const coerce = coerceForFieldType(field.type);
    const targetField = asRec(overridesControl)[key];
    const nullInit = hasSchemaTag(field, SchemaTags.ScriptNullInit);
    const staticValue = targetRec?.[key];
    const initValue = nullInit
      ? (NoOverride as unknown)
      : coerce(staticValue ?? undefined);
    const registered = evalExpr(
      initValue,
      targetField,
      expr,
      coerce as (v: unknown) => any,
      addCleanup,
    );
    if (registered) hasOverrides = true;
  }

  // `_ScriptNullInit` fields with no explicit script — seed the override
  // with the coerced static value so the proxy resolves through the same
  // coercion path as the scripted case.
  for (const field of fields) {
    if (!hasSchemaTag(field, SchemaTags.ScriptNullInit)) continue;
    if (scriptedKeys.has(field.field)) continue;
    const coerce = coerceForFieldType(field.type);
    const staticValue = targetRec?.[field.field];
    const coerced = coerce(staticValue ?? undefined);
    const targetField = asRec(overridesControl)[field.field];
    ctx.update((wc) => wc.setValue(targetField, coerced));
    hasOverrides = true;
  }

  // Recurse into non-collection compound children — but only when the
  // subtree actually needs an override control. Materialising
  // `overridesControl.fields.X` unconditionally would add `X` to the
  // parent's `existingFields` and shadow the base compound value on read.
  for (const field of fields) {
    if (!isCompoundField(field) || field.collection) continue;
    let childFields = getChildFields(field);
    if (!childFields?.length) continue;

    // Plugin extension point: when descending into `renderOptions`,
    // append any extra fields registered by data-plugins (e.g. a custom
    // `Stars` plugin's `maxStars`). Without this the walker can't see
    // scripts on the plugin's options and they silently no-op.
    if (
      field.field === "renderOptions" &&
      extraRenderOptionFields.length > 0
    ) {
      childFields = [...childFields, ...extraRenderOptionFields];
    }

    const childTarget = targetRec?.[field.field];
    const childPath = path ? path + "." + field.field : field.field;
    if (!subtreeHasScripts(childTarget, childFields, childPath, getScripts)) {
      continue;
    }

    const childOverrides = asRec(overridesControl)[
      field.field
    ] as unknown as Control<Record<string, unknown>>;
    const childBuilders = new Map<string, NestedProxyBuilder>();

    const childHad = buildLevel(
      childTarget,
      childFields,
      childOverrides,
      childPath,
      evalExpr,
      getScripts,
      addCleanup,
      ctx,
      childBuilders,
      extraRenderOptionFields,
    );

    if (childHad) {
      hasOverrides = true;
      nestedBuilders.set(field.field, (childBase, rc) =>
        createOverrideProxy(childBase, childOverrides, rc, childBuilders),
      );
    }
  }

  return hasOverrides;
}
