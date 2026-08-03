import type { ReadContext } from "@rxc/controls-core";
import type { FormStateNode } from "@rxc/forms-core";

export interface FormError {
  /** The descendant node that owns the error. */
  node: FormStateNode;
  /** Stable identifier of the FormStateNode (mirror of `node.uniqueId`,
   * convenient for use as a React key). */
  uniqueId: string;
  /** The first error message published on this node's bound data control. */
  error: string;
}

/**
 * Recursively walk a {@link FormStateNode} and its descendants, collecting
 * one entry per node that is currently *touched* and has at least one
 * validation error published on its bound data control.
 *
 * Intended for error-summary panels, submit guards, and any host UI that
 * needs to present a flat list of validation problems aggregated from a
 * form subtree.
 *
 * Reads through the supplied {@link ReadContext}, so subscribers to the
 * returned list re-run when any reached error or touched state changes.
 * Designed to be called from inside `useControls()` components or
 * other rc-aware computations.
 *
 * Hidden subtrees (`visible === false`) are skipped — matching legacy
 * behavior where validation messages don't surface for fields the user
 * cannot see.
 */
export function useFormErrors(
  rc: ReadContext,
  node: FormStateNode,
): FormError[] {
  const out: FormError[] = [];
  walk(rc, node, out);
  return out;
}

function walk(rc: ReadContext, node: FormStateNode, out: FormError[]): void {
  const state = node.getState(rc);
  if (state.visible === false) return;
  if (state.data && state.touched) {
    const error = rc.getError(state.data);
    if (error) {
      out.push({ node, uniqueId: node.uniqueId, error });
    }
  }
  for (const child of node.getChildren(rc)) {
    walk(rc, child, out);
  }
}
