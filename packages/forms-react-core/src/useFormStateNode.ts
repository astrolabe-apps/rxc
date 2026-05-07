"use client";

import { useEffect, useRef } from "react";
import type { ControlContext } from "@rxc/controls-core";
import {
  createFormStateNode,
  defaultResolveChildren,
  type ChildResolverFunc,
  type DataNode,
  type FormGlobalOptions,
  type FormNode,
  type FormStateNode,
} from "@rxc/forms-core";
import { collectExtraRenderOptionFields } from "./plugins";
import type { FormRegistry } from "./registry";
import type { UseFormStateNodeOptions } from "./types";

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
 * explicitly — platform packages (`@rxc/forms`, `@rxc/forms-native`)
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
      runAsync: opts.runAsync ?? ((fn) => fn()),
      clearHidden: opts.clearHidden ?? true,
      extraRenderOptionFields: collectExtraRenderOptionFields(reg),
    };
    slotRef.current = {
      key: { controlContext, form, dataNode },
      node: createFormStateNode(controlContext, form, dataNode, globals),
    };
  }

  // Final cleanup on unmount — releases the live tree. Strict Mode runs
  // this twice (mount → cleanup → re-mount); the re-mount path is
  // handled by the `sameKey` check above, which sees a null slot and
  // re-creates the node on the next render.
  useEffect(() => {
    return () => {
      slotRef.current?.node.cleanup();
      slotRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return slotRef.current!.node;
}
