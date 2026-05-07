"use client";

import type { ControlContext } from "@rxc/controls-core";
import type {
  DataNode,
  FormNode,
  FormStateNode,
} from "@rxc/forms-core";
import { useFormStateNode as useFormStateNodeCore } from "@rxc/forms-react-core";
import { defaultRegistry } from "./builtins";
import type { UseFormStateNodeOptions } from "./types";

/**
 * Build the root FormStateNode for a form. Thin wrapper over the
 * headless `@rxc/forms-react-core` helper that supplies the HTML
 * `defaultRegistry()` when `options.registry` is omitted.
 */
export function useFormStateNode(
  controlContext: ControlContext,
  form: FormNode,
  dataNode: DataNode,
  options: UseFormStateNodeOptions = {},
): FormStateNode {
  return useFormStateNodeCore(controlContext, form, dataNode, {
    ...options,
    registry: options.registry ?? defaultRegistry(),
  });
}
