import type { ReadContext } from "@rxc/controls-core";
import type {
  ChildResolverFunc,
  DisplayData,
  FormStateNode,
} from "@rxc/forms-core";
import type { AdornmentRegistration } from "./Adornment";
import type {
  ActionMatch,
  DataMatch,
  DisplayMatch,
  GroupMatch,
} from "./types";

/**
 * Per-render-type schema metadata, keyed by the render type's `type`
 * string. The shape of each entry mirrors `ControlDefinitionSchemaMap`
 * entries from forms-core (see `schemaSchemas.ts`) — opaque to the
 * renderer, consumed by the scripted-proxy walker.
 */
export type SchemaExtensionsMap = Record<string, unknown>;

// ── Matcher function types ───────────────────────────────────────────

export type DataMatcher = (
  node: FormStateNode,
  rc: ReadContext,
) => DataMatch | null;

export type GroupMatcher = (
  node: FormStateNode,
  rc: ReadContext,
) => GroupMatch | null;

export type ActionMatcher = (
  node: FormStateNode,
  rc: ReadContext,
) => ActionMatch | null;

export type DisplayMatcher = (data: DisplayData) => DisplayMatch | null;

// ── Registry ─────────────────────────────────────────────────────────

export interface FormRegistry {
  data: DataMatcher[];
  group: GroupMatcher[];
  action: ActionMatcher[];
  display: DisplayMatcher[];
  /** Adornment registrations by `type` discriminator. Earlier entries
   * shadow later ones (same rule as the matcher arrays). */
  adornments: AdornmentRegistration[];
  schemaExtensions: SchemaExtensionsMap;
  childResolvers: Record<string, ChildResolverFunc>;
}

export function emptyRegistry(): FormRegistry {
  return {
    data: [],
    group: [],
    action: [],
    display: [],
    adornments: [],
    schemaExtensions: {},
    childResolvers: {},
  };
}

/**
 * Concatenate registries in argument order — earlier registries take
 * precedence. Matcher arrays are concatenated so the first matcher to
 * return non-null wins. `schemaExtensions` and `childResolvers` are
 * merged shallowly with earlier-registry entries shadowing later ones.
 */
export function combineRegistries(
  ...regs: Array<Partial<FormRegistry>>
): FormRegistry {
  const out = emptyRegistry();
  for (const r of regs) {
    if (r.data) out.data.push(...r.data);
    if (r.group) out.group.push(...r.group);
    if (r.action) out.action.push(...r.action);
    if (r.display) out.display.push(...r.display);
    if (r.adornments) out.adornments.push(...r.adornments);
    if (r.schemaExtensions) {
      for (const [k, v] of Object.entries(r.schemaExtensions)) {
        if (!(k in out.schemaExtensions)) out.schemaExtensions[k] = v;
      }
    }
    if (r.childResolvers) {
      for (const [k, v] of Object.entries(r.childResolvers)) {
        if (!(k in out.childResolvers)) out.childResolvers[k] = v;
      }
    }
  }
  return out;
}

// ── Dispatch helpers ─────────────────────────────────────────────────

export function pickDataRenderer(
  matchers: DataMatcher[],
  node: FormStateNode,
  rc: ReadContext,
): DataMatch | null {
  for (const m of matchers) {
    const hit = m(node, rc);
    if (hit) return hit;
  }
  return null;
}

export function pickGroupRenderer(
  matchers: GroupMatcher[],
  node: FormStateNode,
  rc: ReadContext,
): GroupMatch | null {
  for (const m of matchers) {
    const hit = m(node, rc);
    if (hit) return hit;
  }
  return null;
}

export function pickActionRenderer(
  matchers: ActionMatcher[],
  node: FormStateNode,
  rc: ReadContext,
): ActionMatch | null {
  for (const m of matchers) {
    const hit = m(node, rc);
    if (hit) return hit;
  }
  return null;
}

export function pickDisplayRenderer(
  matchers: DisplayMatcher[],
  data: DisplayData,
): DisplayMatch | null {
  for (const m of matchers) {
    const hit = m(data);
    if (hit) return hit;
  }
  return null;
}
