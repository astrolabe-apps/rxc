"use client";

import { useCallback } from "react";
import type { FormStateNode } from "@rxc/forms-core";
import type { ActionHandler } from "./ActionScope";

/**
 * Execute an action handler and manage the busy lifecycle on a node.
 *
 * - Synchronous return: nothing extra — busy is not toggled.
 * - Promise return: `node.setBusy(true)` before the await; `.catch`
 *   logs and swallows so a rejection doesn't pin busy; `.finally`
 *   always releases it.
 *
 * The legacy bug this fixes was a missing `.catch` that left the form
 * busy indefinitely on rejection. Phase 3 supports `disableType:
 * "Self"` only — broader form/global busy requires
 * `acquireDisabler` on FormNodeUi (Phase 4b).
 *
 * Pure function — `useAsyncAction` below wraps it in a `useCallback`.
 */
export function runAsyncAction(
  node: FormStateNode,
  handler: ActionHandler | null | undefined,
  actionId: string,
  actionData: unknown,
): void {
  if (!handler) return;
  let result: unknown;
  try {
    result = handler(actionId, actionData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[@rxc/forms] action threw", err);
    return;
  }
  if (result instanceof Promise) {
    node.setBusy(true);
    result
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[@rxc/forms] action rejected", err);
      })
      .finally(() => {
        node.setBusy(false);
      });
  }
}

export function useAsyncAction(
  node: FormStateNode,
  handler: ActionHandler | null | undefined,
  actionId: string,
  actionData: unknown,
): () => void {
  return useCallback(
    () => runAsyncAction(node, handler, actionId, actionData),
    [node, handler, actionId, actionData],
  );
}
