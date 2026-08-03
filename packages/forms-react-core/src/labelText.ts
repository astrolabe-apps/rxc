import type { ReadContext } from "@rxc/controls-core";
import {
  isDataControl,
  isGroupControl,
  type FormStateNode,
} from "@rxc/forms-core";

/**
 * Resolve the label text for a node, or `null` to suppress the label.
 *
 * - Data controls use `definition.title`, then the schema field's
 *   `displayName`, then the bare field name.
 * - Group controls use `definition.title` only.
 * - `hideTitle` on data, or `groupOptions.hideTitle` on groups, returns `null`.
 * - Action and Display controls don't have engine-emitted labels.
 */
export function resolveLabelText(
  node: FormStateNode,
  rc: ReadContext,
): string | null {
  const state = node.getState(rc);
  const def = state.definition;
  if (isDataControl(def)) {
    if (def.hideTitle) return null;
    return (
      def.title ?? state.field?.displayName ?? state.field?.field ?? null
    );
  }
  if (isGroupControl(def)) {
    if (def.groupOptions && (def.groupOptions as { hideTitle?: boolean }).hideTitle)
      return null;
    return def.title ?? null;
  }
  return null;
}
