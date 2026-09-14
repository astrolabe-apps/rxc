"use client";

import type { ControlContext } from "@rx-controls/core";
import type {
  DataNode,
  FormNode,
  FormStateNode,
} from "@rx-controls/forms-core";
import { useFormStateNode as useFormStateNodeCore } from "@rx-controls/forms-react-core";
import { defaultRegistry } from "./builtins";
import type { UseFormStateNodeOptions } from "./types";

/**
 * Build the root FormStateNode for a form. Thin wrapper over the
 * headless `@rx-controls/forms-react-core` helper that supplies the HTML
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
