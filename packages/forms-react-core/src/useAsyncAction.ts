"use client";

import { useCallback } from "react";
import {
  ControlDisableType,
  type FormStateNode,
} from "@rxc/forms-core";
import type { ActionHandler } from "./ActionScope";

/**
 * Execute an action handler and manage the busy + disabler lifecycle on
 * a node.
 *
 * - Synchronous return: nothing extra — busy is not toggled and no
 *   disabler is held.
 * - Promise return: `node.setBusy(true)` before the await; if a
 *   `disableType` other than `None` is supplied, also acquire a
 *   disabler hold via {@link FormStateNode.acquireDisabler}. `.catch`
 *   logs and swallows so a rejection doesn't pin busy/disabled;
 *   `.finally` always releases both.
 *
 * `disableType` defaults to `None` so legacy callers see the previous
 * behavior. `Self` adds a node-local hold (in addition to busy);
 * `Form` / `Global` walk to the form root and disable the entire tree
 * for the duration of the action.
 */
export function runAsyncAction(
  node: FormStateNode,
  handler: ActionHandler | null | undefined,
  actionId: string,
  actionData: unknown,
  disableType: ControlDisableType = ControlDisableType.None,
): void {
  if (!handler) return;
  let result: unknown;
  try {
    result = handler(actionId, actionData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[@rxc/forms-react-core] action threw", err);
    return;
  }
  if (result instanceof Promise) {
    node.setBusy(true);
    const releaseDisabler =
      disableType === ControlDisableType.None
        ? null
        : node.acquireDisabler(disableType);
    result
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[@rxc/forms-react-core] action rejected", err);
      })
      .finally(() => {
        node.setBusy(false);
        releaseDisabler?.();
      });
  }
}

export function useAsyncAction(
  node: FormStateNode,
  handler: ActionHandler | null | undefined,
  actionId: string,
  actionData: unknown,
  disableType: ControlDisableType = ControlDisableType.None,
): () => void {
  return useCallback(
    () => runAsyncAction(node, handler, actionId, actionData, disableType),
    [node, handler, actionId, actionData, disableType],
  );
}
