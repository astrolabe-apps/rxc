"use client";

import { useMemo } from "react";
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
import { defaultRegistry } from "./builtins";
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

/**
 * Build the root FormStateNode for a form, memoized on its identity inputs.
 * Use when the host needs a handle to the FormStateNode itself (e.g. to
 * inspect the tree, drive validation, or coordinate with external UI).
 *
 * Otherwise pass `form` + `dataNode` straight to `<Form>` via `node={...}`
 * built inline — the Form component itself does not construct FormStateNodes.
 */
export function useFormStateNode(
  controlContext: ControlContext,
  form: FormNode,
  dataNode: DataNode,
  options: UseFormStateNodeOptions = {},
): FormStateNode {
  const reg = options.registry ?? defaultRegistry();
  return useMemo(() => {
    const globals: FormGlobalOptions = {
      schemaInterface: options.schemaInterface,
      resolveChildren: makeResolveChildren(reg),
      runAsync: options.runAsync ?? ((fn) => fn()),
      clearHidden: options.clearHidden ?? true,
      extraRenderOptionFields: collectExtraRenderOptionFields(reg),
    };
    return createFormStateNode(controlContext, form, dataNode, globals);
    // Identity inputs only; option fields are read at construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlContext, form, dataNode]);
}
