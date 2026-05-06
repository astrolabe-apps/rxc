"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";

/**
 * Result returned by an action handler. Truthy values claim the action
 * (the walk stops); `undefined`/`false` falls through to the parent
 * scope. Handlers may return synchronously or asynchronously — the
 * dispatcher awaits before deciding whether to fall through.
 */
export type ActionHandlerResult = unknown;

export type ActionHandler = (
  actionId: string,
  actionData: unknown,
) => ActionHandlerResult | Promise<ActionHandlerResult>;

interface ActionScopeNode {
  handler: ActionHandler;
  parent: ActionScopeNode | null;
}

const ActionScopeContext = createContext<ActionScopeNode | null>(null);

/**
 * Install a local action handler. Handlers in nested `<ActionScope>`s
 * shadow ancestor scopes; returning `undefined` (or `false`) falls
 * through to the parent. Used by Dialog/Wizard renderers to intercept
 * `openDialog`/`closeDialog`/`next`/`prev` IDs without disturbing the
 * host's global handler.
 */
export function ActionScope({
  onAction,
  children,
}: {
  onAction: ActionHandler;
  children: ReactNode;
}) {
  const parent = useContext(ActionScopeContext);
  const node: ActionScopeNode = { handler: onAction, parent };
  return (
    <ActionScopeContext.Provider value={node}>
      {children}
    </ActionScopeContext.Provider>
  );
}

/**
 * Walk the ancestor `<ActionScope>` chain, dispatching `(actionId,
 * actionData)` to each handler. The first handler to return a truthy
 * value claims the action. Falls back to a no-op if no scope claims it.
 */
export function useActionHandler(): ActionHandler {
  const scope = useContext(ActionScopeContext);
  return useCallback(
    async (actionId, actionData) => {
      let cur = scope;
      while (cur) {
        const result = await cur.handler(actionId, actionData);
        if (result) return result;
        cur = cur.parent;
      }
      return undefined;
    },
    [scope],
  );
}
