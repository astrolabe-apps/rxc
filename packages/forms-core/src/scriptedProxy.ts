import type { Control, ControlContext } from "@rxc/controls-core";
import {
  type ControlDefinition,
  type EntityExpression,
  FieldType,
} from "./json";
import {
  createEvalExpr,
  defaultEvaluators,
  type EvalExpr,
  type ExpressionEval,
  type ExpressionEvalContext,
} from "./evalExpression";
import { createOverrideProxy, NoOverride } from "./overrideProxy";
import type { DataNode, VariablesFunc } from "./types";
import type { SchemaInterface } from "./schemaInterface";
import type { ReadContext } from "@rxc/controls-core";

// ── Field metadata (layer 4a) ─────────────────────────────────────
//
// The full astrolabe-common implementation walks the self-describing schema
// (ControlDefinitionSchemaMap — 1700+ lines) to learn each field's type for
// coercion and its `_ScriptNullInit` tag. Porting that wholesale is out of
// scope for this layer. Instead we hardcode the known scriptable fields —
// this covers every legacy dynamic[] target (Visible/Disabled/Readonly/
// Label/DefaultValue/Style/ActionData/LayoutStyle/AllowedOptions) plus the
// `$scripts` convention for the same properties.
//
// TODO(Layer 4c or later): port `schemaSchemas.ts` so any user-defined
// ControlDefinition extension gets correct coercion and tagging.

/** Coercion function registered for a scriptable field. */
type Coerce = (v: unknown) => unknown;

interface FieldMeta {
  coerce: Coerce;
  scriptNullInit?: boolean;
  staticDefault?: unknown;
}

/** Coercion helpers matching `controlDefinitionSchemas.ts:coerceForFieldType`. */
const coerceBool: Coerce = (r) => !!r;
const coerceNum: Coerce = (r) => (typeof r === "number" ? r : undefined);
const coerceString: Coerce = (v) => {
  if (typeof v === "string") return v;
  if (v == null) return "";
  switch (typeof v) {
    case "number":
    case "boolean":
      return v.toString();
    default:
      return JSON.stringify(v);
  }
};
const coerceAny: Coerce = (v) => v;
const coerceObject: Coerce = (v) =>
  typeof v === "object" ? v : undefined;

/**
 * The set of fields on a {@link ControlDefinition} that can be driven by
 * scripts. Keys match the field names; values give the coercion applied
 * after a script produces a result and whether the field uses
 * `_ScriptNullInit` semantics (see FORM-SEMANTICS.md).
 */
const SCRIPTABLE_FIELDS: Record<string, FieldMeta> = {
  hidden: { coerce: coerceBool, scriptNullInit: true, staticDefault: false },
  disabled: { coerce: coerceBool, staticDefault: false },
  readonly: { coerce: coerceBool, staticDefault: false },
  required: { coerce: coerceBool, staticDefault: false },
  title: { coerce: coerceString },
  defaultValue: { coerce: coerceAny },
  actionData: { coerce: coerceAny },
  style: { coerce: coerceObject },
  layoutStyle: { coerce: coerceObject },
  allowedOptions: { coerce: coerceAny },
};

export function coerceForFieldType(fieldType: string): Coerce {
  switch (fieldType) {
    case FieldType.Bool:
      return coerceBool;
    case FieldType.Int:
    case FieldType.Double:
      return coerceNum;
    case FieldType.String:
      return coerceString;
    case FieldType.Compound:
      return coerceObject;
    default:
      return coerceAny;
  }
}

// ── Script provider ──────────────────────────────────────────────

/**
 * Resolves the script map for a given definition path. The default reads
 * `def["$scripts"]` at the root; callers can supply a custom provider to
 * inject legacy `dynamic[]` entries or any other source.
 */
export type ScriptProvider = (
  target: ControlDefinition,
  path: string,
) => Record<string, EntityExpression>;

export const defaultScriptProvider: ScriptProvider = (target) =>
  ((target as unknown as Record<string, unknown>)?.["$scripts"] as Record<
    string,
    EntityExpression
  >) ?? {};

// ── createEvaluatedDefinition ────────────────────────────────────

/**
 * Options returned by {@link createEvaluatedDefinition} — the caller uses
 * `toProxy(rc)` inside a reactive read to obtain a definition whose
 * scripted properties resolve through the given {@link ReadContext}.
 */
export interface EvaluatedDefinition {
  /** Underlying base definition, unchanged. */
  base: ControlDefinition;
  /** Snapshot indicator — `true` iff any scripted override was registered. */
  hasOverrides: boolean;
  /** Build a reactive proxy bound to the given `ReadContext`. */
  toProxy(rc: ReadContext): ControlDefinition;
}

/**
 * Build a scripted definition wrapper:
 *
 * 1. Collect root-level scripts via `getScripts(def, "")`.
 * 2. Handle `_ScriptNullInit` fields — initialize their override to
 *    {@link NoOverride} (so the proxy falls through to the base) or, when a
 *    script is registered, let the script's effect populate the override.
 * 3. Return an `EvaluatedDefinition` whose `toProxy(rc)` call produces the
 *    rc-bound proxy.
 *
 * **Scope (layer 4a):** only root-level scriptable fields are handled.
 * Nested compounds (e.g. `displayData.text`, `renderOptions.groupOptions
 * .columns`) still fall through to static values — porting the nested
 * proxy wiring is a follow-up.
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
): EvaluatedDefinition {
  const scripts = getScripts(def, "");
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

  let hasOverrides = false;

  // Register explicit scripts
  for (const [key, expr] of Object.entries(scripts)) {
    const meta = SCRIPTABLE_FIELDS[key];
    if (!meta) continue;

    const targetField = (
      overridesControl.fields as unknown as Record<string, Control<unknown>>
    )[key];

    const staticValue = (def as unknown as Record<string, unknown>)[key];
    // `_ScriptNullInit` fields start as NoOverride so the proxy falls
    // through to the base value while the script is pending.
    const initValue = meta.scriptNullInit
      ? (NoOverride as unknown)
      : meta.coerce(staticValue ?? meta.staticDefault);

    const registered = evalExpr(
      initValue,
      targetField,
      expr,
      meta.coerce,
      addCleanup,
    );
    if (registered) hasOverrides = true;
  }

  // For `_ScriptNullInit` fields without an explicit script, initialise
  // the override to the coerced static value so the proxy routes through
  // the same field-type coercion path as the scripted case. This matches
  // the old `evaluateScripts` behaviour (scriptedProxy.ts:96-118).
  for (const [key, meta] of Object.entries(SCRIPTABLE_FIELDS)) {
    if (!meta.scriptNullInit) continue;
    if (key in scripts) continue; // handled above

    const staticValue = (def as unknown as Record<string, unknown>)[key];
    const coerced = meta.coerce(staticValue ?? meta.staticDefault);
    const targetField = (
      overridesControl.fields as unknown as Record<string, Control<unknown>>
    )[key];
    ctx.update((wc) => wc.setValue(targetField, coerced));
    hasOverrides = true;
  }

  return {
    base: def,
    hasOverrides,
    toProxy(rc: ReadContext): ControlDefinition {
      if (!hasOverrides) return def;
      return createOverrideProxy(def, overridesControl, rc);
    },
  };
}
