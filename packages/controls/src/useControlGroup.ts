"use client";

import { useEffect, useRef } from "react";
import { controlGroup, setFields } from "@rxc/controls-core";
import type { Control, ControlValue } from "@rxc/controls-core";
import { useControlContext } from "./useControls";

/**
 * A group control assembled from independently owned controls, stable for
 * this component's lifetime.
 *
 * The children are attached, not copied — see `controlGroup`. Handy for
 * validating or reading several standalone controls as one:
 *
 * ```tsx
 * const name = useControl("");
 * const age = useControl(0);
 * const person = useControlGroup({ name, age });
 * // rc.getValue(person) → { name, age }; rc.isValid(person) aggregates both
 * ```
 *
 * When a field's control *identity* changes between renders, the new control
 * is swapped in via `setFields` while the group keeps its identity. By
 * default every value of `fields` is compared; pass `deps` to narrow that.
 */
export function useControlGroup<C extends { [k: string]: Control<any> }>(
  fields: C,
  deps?: unknown[],
): Control<{ [K in keyof C]: ControlValue<C[K]> }> {
  const ctx = useControlContext();
  const ref = useRef<Control<{ [K in keyof C]: ControlValue<C[K]> }> | null>(
    null,
  );
  if (!ref.current) {
    ref.current = controlGroup(ctx, fields);
  }
  const group = ref.current;

  useEffect(
    () => {
      ctx.update((wc) => setFields(wc, group, fields));
    },
    // Legacy-parity contract: re-attach when any field control's identity
    // changes (or when the caller-supplied deps change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps ?? Object.values(fields),
  );
  return group;
}
