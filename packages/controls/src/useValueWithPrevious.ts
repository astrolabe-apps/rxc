"use client";

import type { Control } from "@rxc/controls-core";
import { useControl } from "./useControl.js";
import { useControlEffect } from "./useControlEffect.js";
import { useControlContext } from "./useControls.js";

/**
 * A control holding a control's current value alongside the value it had
 * before the last change.
 *
 * `previous` is `undefined` until the first change. Read through your `rc`
 * like any other control:
 *
 * ```tsx
 * const withPrev = useValueWithPrevious(price);
 * const { previous, current } = rc.getValue(withPrev);
 * ```
 */
export function useValueWithPrevious<V>(
  control: Control<V>,
): Control<{ previous?: V; current: V }> {
  const ctx = useControlContext();
  const withPrev = useControl<{ previous?: V; current: V }>(() => ({
    current: control.valueNow,
  }));
  useControlEffect(
    (rc) => rc.getValue(control),
    (next) =>
      ctx.update((wc) =>
        wc.updateValue(withPrev, ({ current }) => ({
          previous: current,
          current: next,
        })),
      ),
  );
  return withPrev;
}
