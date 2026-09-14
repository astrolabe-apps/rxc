import type {
  ChildResolverFunc,
  DisplayData,
  SchemaField,
} from "@rx-controls/forms-core";
import {
  matchActionId,
  matchDisplayDataType,
  matchGroupRenderType,
  matchRenderType,
} from "./matchers";
import type {
  ActionMatcher,
  DataMatcher,
  DisplayMatcher,
  FormRegistry,
  GroupMatcher,
} from "./registry";
import type {
  ActionRenderer,
  DataRenderer,
  DisplayRenderer,
  GroupRenderer,
} from "./types";

/**
 * Editor-side plugin metadata. Carried opaquely through the renderer's
 * registry so a future `@rx-controls/forms-editor` package can iterate plugins
 * to populate its tools palette and properties panels. Renderer engine
 * never reads this — it's just plumbing for the editor.
 */
export interface EditorPluginSlot {
  /** Form rendered when this render type is selected in the editor's
   * properties panel. Type kept loose here; the editor package narrows. */
  optionsEditor?: unknown;
  /** Human-readable name for the tools palette. */
  paletteLabel?: string;
  /** Icon for the tools palette. */
  paletteIcon?: unknown;
  /** Additional fields the editor package may attach. */
  [key: string]: unknown;
}

// ── Data plugin ──────────────────────────────────────────────────────

export interface DataPluginSpec {
  /** ControlDefinition `renderOptions.type` discriminator. */
  type: string;
  component: DataRenderer;
  /** True if the renderer absorbs the label into its own DOM. */
  hidesLabel?: boolean;
  /**
   * SchemaField list describing the renderOptions sub-fields of this
   * render type. Set `tags: [SchemaTags.ScriptNullInit]` on a field to
   * make it scriptable. Threaded through to the FormStateNode's
   * scripted-proxy walker via `extraRenderOptionFields`.
   */
  schema?: SchemaField[];
  /** Virtual-children rule (e.g. CheckList per-option expansion). */
  resolveChildren?: ChildResolverFunc;
  /** Override the default `matchRenderType` matcher with custom logic. */
  match?: DataMatcher;
  /** Editor-side metadata, carried opaquely. */
  editor?: EditorPluginSlot;
}

export function dataPlugin(spec: DataPluginSpec): Partial<FormRegistry> {
  const matcher: DataMatcher =
    spec.match ??
    matchRenderType(
      spec.type,
      spec.component,
      spec.hidesLabel ? { hidesLabel: true } : undefined,
    );
  const out: Partial<FormRegistry> = { data: [matcher] };
  if (spec.schema && spec.schema.length > 0) {
    out.schemaExtensions = { [spec.type]: spec.schema };
  }
  if (spec.resolveChildren) {
    out.childResolvers = { [spec.type]: spec.resolveChildren };
  }
  return out;
}

// ── Group plugin ─────────────────────────────────────────────────────

export interface GroupPluginSpec {
  /** ControlDefinition `groupOptions.type` discriminator. */
  type: string;
  component: GroupRenderer;
  hidesLabel?: boolean;
  schema?: SchemaField[];
  resolveChildren?: ChildResolverFunc;
  match?: GroupMatcher;
  editor?: EditorPluginSlot;
}

export function groupPlugin(spec: GroupPluginSpec): Partial<FormRegistry> {
  const matcher: GroupMatcher =
    spec.match ??
    matchGroupRenderType(
      spec.type,
      spec.component,
      spec.hidesLabel ? { hidesLabel: true } : undefined,
    );
  const out: Partial<FormRegistry> = { group: [matcher] };
  if (spec.schema && spec.schema.length > 0) {
    out.schemaExtensions = { [spec.type]: spec.schema };
  }
  if (spec.resolveChildren) {
    out.childResolvers = { [spec.type]: spec.resolveChildren };
  }
  return out;
}

// ── Action plugin ────────────────────────────────────────────────────

export interface ActionPluginSpec {
  /** ControlDefinition `actionId` to match. */
  actionId: string;
  component: ActionRenderer;
  match?: ActionMatcher;
  editor?: EditorPluginSlot;
}

export function actionPlugin(spec: ActionPluginSpec): Partial<FormRegistry> {
  const matcher: ActionMatcher =
    spec.match ?? matchActionId(spec.actionId, spec.component);
  return { action: [matcher] };
}

// ── Display plugin ───────────────────────────────────────────────────

export interface DisplayPluginSpec {
  /** DisplayData `type` discriminator. */
  type: string;
  component: DisplayRenderer;
  match?: DisplayMatcher;
  editor?: EditorPluginSlot;
}

export function displayPlugin(spec: DisplayPluginSpec): Partial<FormRegistry> {
  const matcher: DisplayMatcher =
    spec.match ?? matchDisplayDataType(spec.type, spec.component);
  return { display: [matcher] };
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Collect the union of `schema` fields across all data/group plugins in
 * a registry. The renderer passes this to forms-core via
 * `FormGlobalOptions.extraRenderOptionFields`.
 */
export function collectExtraRenderOptionFields(
  registry: FormRegistry,
): SchemaField[] {
  const out: SchemaField[] = [];
  for (const [renderType, fields] of Object.entries(
    registry.schemaExtensions,
  )) {
    if (!Array.isArray(fields)) continue;
    for (const f of fields as SchemaField[]) {
      // Tag the field with onlyForTypes if not already set, so it's
      // editor-discriminated by render type. This is a hint the editor
      // package may use; the runtime walker today doesn't filter.
      const existing = f.onlyForTypes ?? null;
      out.push(
        existing
          ? f
          : ({ ...f, onlyForTypes: [renderType] } as SchemaField),
      );
    }
  }
  return out;
}

// Re-exports for plugin authors
export type { ChildResolverFunc, DisplayData, SchemaField };
