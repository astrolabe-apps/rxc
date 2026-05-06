import type { ReadContext } from "@rxc/controls-core";
import {
  isDataControl,
  isDisplayControl,
  isGroupControl,
  isActionControl,
  type DisplayData,
  type FormStateNode,
} from "@rxc/forms-core";
import type {
  ActionMatcher,
  DataMatcher,
  DisplayMatcher,
  GroupMatcher,
} from "./registry";
import type {
  ActionRenderer,
  DataMatch,
  DataRenderer,
  DisplayRenderer,
  GroupMatch,
  GroupRenderer,
} from "./types";

// ── Data matchers ────────────────────────────────────────────────────

type DataMeta = Omit<DataMatch, "component">;

function dataMatch(component: DataRenderer, meta?: DataMeta): DataMatch {
  return meta ? { component, ...meta } : { component };
}

/** Match a data control by `renderOptions.type`. */
export function matchRenderType(
  type: string,
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isDataControl(def)) return null;
    if (def.renderOptions?.type !== type) return null;
    return dataMatch(component, meta);
  };
}

/** Match any of several `renderOptions.type` values. */
export function matchRenderTypeOneOf(
  types: string[],
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  const set = new Set(types);
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isDataControl(def)) return null;
    const t = def.renderOptions?.type;
    if (!t || !set.has(t)) return null;
    return dataMatch(component, meta);
  };
}

/** Match by the resolved schema field's `type`. */
export function matchSchemaType(
  fieldType: string,
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  return (node, rc) => {
    const state = node.getState(rc);
    if (!state.field) return null;
    if (state.field.type !== fieldType) return null;
    return dataMatch(component, meta);
  };
}

/** Match data nodes whose schema field is a collection. */
export function matchCollection(
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  return (node, rc) => {
    const state = node.getState(rc);
    if (!state.field?.collection) return null;
    return dataMatch(component, meta);
  };
}

/** Match data nodes that have non-empty options. */
export function matchHasOptions(
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  return (node, rc) => {
    const opts = node.getState(rc).fieldOptions;
    if (!opts || opts.length === 0) return null;
    return dataMatch(component, meta);
  };
}

/** Catch-all data matcher. */
export function matchDataAlways(
  component: DataRenderer,
  meta?: DataMeta,
): DataMatcher {
  return () => dataMatch(component, meta);
}

/**
 * Combine multiple data matchers: all must produce a non-null match;
 * the *last* match's component+metadata is used (so ordering matters —
 * put the predicate matchers first, the producing matcher last).
 */
export function matchAll(...matchers: DataMatcher[]): DataMatcher {
  return (node, rc) => {
    let last: DataMatch | null = null;
    for (const m of matchers) {
      const hit = m(node, rc);
      if (!hit) return null;
      last = hit;
    }
    return last;
  };
}

/** First non-null match wins. Rare but available for symmetry. */
export function matchAny(...matchers: DataMatcher[]): DataMatcher {
  return (node, rc) => {
    for (const m of matchers) {
      const hit = m(node, rc);
      if (hit) return hit;
    }
    return null;
  };
}

/** True only for data controls with a compound schema field. */
export function matchCompoundField(component: DataRenderer): DataMatcher {
  return (node, rc) => {
    const state = node.getState(rc);
    if (!state.field) return null;
    if (state.field.type !== "Compound") return null;
    return dataMatch(component);
  };
}

// ── Group matchers ───────────────────────────────────────────────────

type GroupMeta = Omit<GroupMatch, "component">;

function groupMatch(component: GroupRenderer, meta?: GroupMeta): GroupMatch {
  return meta ? { component, ...meta } : { component };
}

export function matchGroupRenderType(
  type: string,
  component: GroupRenderer,
  meta?: GroupMeta,
): GroupMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isGroupControl(def)) return null;
    if (def.groupOptions?.type !== type) return null;
    return groupMatch(component, meta);
  };
}

export function matchGroupAlways(
  component: GroupRenderer,
  meta?: GroupMeta,
): GroupMatcher {
  return () => groupMatch(component, meta);
}

// ── Action matchers ──────────────────────────────────────────────────

export function matchActionId(
  actionId: string,
  component: ActionRenderer,
): ActionMatcher {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    if (!isActionControl(def)) return null;
    if (def.actionId !== actionId) return null;
    return { component };
  };
}

export function matchActionAlways(component: ActionRenderer): ActionMatcher {
  return () => ({ component });
}

// ── Display matchers ─────────────────────────────────────────────────

export function matchDisplayDataType(
  type: string,
  component: DisplayRenderer,
): DisplayMatcher {
  return (data) => (data.type === type ? { component } : null);
}

export function matchDisplayAlways(
  component: DisplayRenderer,
): DisplayMatcher {
  return () => ({ component });
}

// ── Definition-kind helpers (re-exported for convenience) ────────────

export {
  isDataControl,
  isGroupControl,
  isActionControl,
  isDisplayControl,
};
export type { DisplayData, FormStateNode, ReadContext };
