"use client";

import { useEffect, useRef } from "react";
import {
  untrackedRead,
  type Control,
  type ControlContext,
  type ReadContext,
} from "@rxc/controls-core";
import { useControlContext } from "@rxc/controls";
import {
  ExpressionType,
  defaultEvaluators,
  type EntityExpression,
  type ExpressionEval,
  type ExpressionEvalContext,
  type FormStateNode,
  type NotExpression,
} from "@rxc/forms-core";

/**
 * Read the value produced by an `EntityExpression` against a node's data
 * context.
 *
 * Supports every kind in {@link defaultEvaluators}: `Data`, `DataMatch`,
 * `NotEmpty`, `UUID`, `Jsonata`, and `Not` wrappers around any of those.
 * Async expressions (Jsonata) update reactively as their inputs change;
 * the latest result is exposed through the returned value.
 *
 * The hook allocates a single result `Control<unknown>` per call site
 * (kept across renders) and registers the evaluator on mount + when
 * `expr` identity changes; cleanup runs on unmount and on swap.
 *
 * Must be called from a `useReactive()` render so a `ReadContext` is in
 * scope (passed in as the first argument) and a `ControlContext` is
 * available via `useControlContext()`.
 */
export function useExpression(
  rc: ReadContext,
  node: FormStateNode,
  expr: EntityExpression | null | undefined,
): unknown {
  const ctx = useControlContext();

  const containerRef = useRef<Control<unknown> | null>(null);
  if (!containerRef.current) {
    containerRef.current = ctx.newControl<unknown>(undefined);
  }
  const container = containerRef.current;

  useEffect(() => {
    if (!expr?.type) {
      ctx.update((wc) => wc.setValue(container, undefined));
      return;
    }

    let actualExpr: EntityExpression = expr;
    let coerce: (r: unknown) => unknown = (r) => r;
    while (actualExpr?.type === ExpressionType.Not) {
      const inner = (actualExpr as NotExpression).innerExpression;
      if (!inner) break;
      const prev = coerce;
      coerce = (r) => prev(!r);
      actualExpr = inner;
    }
    const evaluator = actualExpr?.type
      ? (defaultEvaluators[actualExpr.type] as ExpressionEval<EntityExpression> | undefined)
      : undefined;
    if (!evaluator) {
      ctx.update((wc) => wc.setValue(container, undefined));
      return;
    }

    const cleanups: Array<() => void> = [];
    const evalCtx: ExpressionEvalContext = {
      ctx,
      dataNode: node.parent,
      schemaInterface: node.schemaInterface,
      variables: node.getState(untrackedRead).variables,
      runAsync: (fn) => queueMicrotask(fn),
      addCleanup: (f) => cleanups.push(f),
      returnResult: (r) =>
        ctx.update((wc) => wc.setValue(container, coerce(r))),
    };

    evaluator(actualExpr, evalCtx);

    return () => {
      for (const f of cleanups) f();
      ctx.update((wc) => wc.setValue(container, undefined));
    };
  }, [expr, ctx, container, node]);

  return rc.getValue(container);
}

/**
 * Node-meta version of {@link useExpression}: registers an evaluator once
 * per `metaKey` on the given {@link FormStateNode} and returns the result
 * `Control<unknown>`. Subsequent calls with the same `metaKey` return the
 * same control without re-registering — caching is keyed entirely by
 * `metaKey`, so callers must vary the key if the expression identity might
 * change (rare outside design mode).
 *
 * Use this from a `useReactive()` render where you need a per-row / per-cell
 * expression result without driving a hook (e.g. dynamic numbers of cells
 * in a DataGrid). Cleanup runs when the host node is cleaned up.
 *
 * `expr` must have a `type` matching {@link defaultEvaluators}; pass a
 * coerce function for `Not`-style inversions handled by the caller.
 */
export function ensureExpressionResult(
  ctx: ControlContext,
  node: FormStateNode,
  expr: EntityExpression,
  metaKey: string,
  initial: unknown = undefined,
): Control<unknown> {
  return node.ensureMeta(metaKey, (scope) => {
    const container = ctx.newControl<unknown>(initial);

    let actualExpr: EntityExpression = expr;
    let coerce: (r: unknown) => unknown = (r) => r;
    while (actualExpr?.type === ExpressionType.Not) {
      const inner = (actualExpr as NotExpression).innerExpression;
      if (!inner) break;
      const prev = coerce;
      coerce = (r) => prev(!r);
      actualExpr = inner;
    }
    const evaluator = actualExpr?.type
      ? (defaultEvaluators[actualExpr.type] as
          | ExpressionEval<EntityExpression>
          | undefined)
      : undefined;
    if (!evaluator) return container;

    const cleanups: Array<() => void> = [];
    const evalCtx: ExpressionEvalContext = {
      ctx,
      dataNode: node.parent,
      schemaInterface: node.schemaInterface,
      variables: node.getState(untrackedRead).variables,
      runAsync: (fn) => queueMicrotask(fn),
      addCleanup: (f) => cleanups.push(f),
      returnResult: (r) =>
        ctx.update((wc) => wc.setValue(container, coerce(r))),
    };
    evaluator(actualExpr, evalCtx);

    scope.addCleanup(() => {
      for (const f of cleanups) f();
    });

    return container;
  });
}
