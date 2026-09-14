"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ControlContext } from "@rx-controls/core";
import {
  createFormStateNode,
  defaultResolveChildren,
  type ChildResolverFunc,
  type DataNode,
  type FormGlobalOptions,
  type FormNode,
  type FormStateNode,
} from "@rx-controls/forms-core";
import { collectExtraRenderOptionFields } from "./plugins";
import type { FormRegistry } from "./registry";
import type { UseFormStateNodeOptions } from "./types";
import { useDeferredCleanup } from "./useDeferredCleanup";

function makeResolveChildren(registry: FormRegistry): ChildResolverFunc {
  return (node, rc) => {
    const def = node.getState(rc).definition;
    const renderType =
      (def as { renderOptions?: { type?: string } }).renderOptions?.type ??
      (def as { groupOptions?: { type?: string } }).groupOptions?.type;
    if (renderType && registry.childResolvers[renderType]) {
      return registry.childResolvers[renderType](node, rc);
    }
    return defaultResolveChildren(node, rc);
  };
}

interface NodeCacheKey {
  controlContext: ControlContext;
  form: FormNode;
  dataNode: DataNode;
}

/**
 * Build the root FormStateNode for a form. Use when the host needs a
 * handle to the FormStateNode itself (e.g. to inspect the tree, drive
 * validation, or coordinate with external UI).
 *
 * The headless layer requires `options.registry` to be supplied
 * explicitly — platform packages (`@rx-controls/forms`, `@rx-controls/forms-native`)
 * wrap this with their own helper that defaults to a platform
 * `defaultRegistry()`.
 *
 * Note: the returned node is created via `useState`/`useRef` rather
 * than `useMemo` because `createFormStateNode` registers `effect`s on
 * the ControlContext that survive the returned reference. `useMemo`
 * re-runs its factory in React Strict Mode, leaking duplicate
 * validators against the same data control. This hook creates the node
 * once per identity-key change and tears down the previous tree via
 * `node.cleanup()` on unmount or input change.
 */
export function useFormStateNode(
  controlContext: ControlContext,
  form: FormNode,
  dataNode: DataNode,
  options: UseFormStateNodeOptions,
): FormStateNode {
  const reg = options.registry;

  // Capture the latest options snapshot — re-reads happen at construction
  // time, so we keep this ref-bound rather than memoizing.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Deferred runAsync ───────────────────────────────────────────────
  //
  // Mirrors the legacy `useAsyncRunner` semantics from
  // `astrolabe-common/schemas/src/RenderForm.tsx`: callbacks passed to
  // `runAsync` during a render are queued and drained inside a `useEffect`
  // *after* React commits. This is what keeps SSR snapshots and the first
  // client hydration in agreement when scripts (Jsonata especially) would
  // otherwise resolve via `queueMicrotask` between SSR HTML ship and CSR
  // commit, causing hydration mismatches on dynamically scripted content.
  //
  // Scripts that schedule themselves later (via the reconciler's
  // microtask `schedule()`) also funnel back through `runAsync`, so they
  // queue and drain on the next commit cycle — never running mid-commit.
  //
  // Identity of the `runAsync` closure is kept stable (useCallback over a
  // ref-bound queue) because `FormStateNode.globals.runAsync` is captured
  // at creation time and lives across renders.
  const queueRef = useRef<Array<() => void>>([]);
  const runAsync = useCallback((fn: () => void) => {
    queueRef.current.push(fn);
  }, []);
  useEffect(() => {
    const q = queueRef.current;
    if (q.length === 0) return;
    queueRef.current = [];
    for (const fn of q) fn();
  });

  // Allow callers to opt back in to a custom runner (e.g. tests) via
  // `options.runAsync`. We snapshot once at node-creation time, so the
  // override is sticky to that node instance.
  const runAsyncForNode = optionsRef.current.runAsync ?? runAsync;

  // Tracking ref for the (key, node) pair currently in use. We compare
  // against incoming identity inputs to decide when to rebuild.
  const slotRef = useRef<{ key: NodeCacheKey; node: FormStateNode } | null>(
    null,
  );

  const sameKey =
    slotRef.current &&
    slotRef.current.key.controlContext === controlContext &&
    slotRef.current.key.form === form &&
    slotRef.current.key.dataNode === dataNode;

  if (!sameKey) {
    // Tear down any previous tree before allocating a new one. This also
    // covers the React Strict Mode pre-mount discard path: a stale
    // FormStateNode lingering from a prior render gets cleaned up before
    // its replacement is registered.
    slotRef.current?.node.cleanup();
    const opts = optionsRef.current;
    const globals: FormGlobalOptions = {
      schemaInterface: opts.schemaInterface,
      resolveChildren: makeResolveChildren(reg),
      runAsync: runAsyncForNode,
      clearHidden: opts.clearHidden ?? true,
      extraRenderOptionFields: collectExtraRenderOptionFields(reg),
    };
    slotRef.current = {
      key: { controlContext, form, dataNode },
      node: createFormStateNode(controlContext, form, dataNode, globals),
    };
  }

  // Final cleanup on unmount — releases the live tree. Deferred so the
  // Strict Mode dev mount → unmount → re-mount cycle doesn't destroy
  // in-flight async work (Jsonata evaluations etc.) kicked off by the
  // first commit; see `useDeferredCleanup` for the rationale.
  useDeferredCleanup(() => {
    slotRef.current?.node.cleanup();
    slotRef.current = null;
  });

  return slotRef.current!.node;
}
