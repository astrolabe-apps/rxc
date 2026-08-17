"use client";

import { useRef } from "react";
import type { Control, ControlSetup } from "@rxc/controls-core";
import { useControlContext } from "./useControls.js";

/**
 * Options for {@link useControl} — a {@link ControlSetup} plus the `use`
 * escape hatch.
 */
export type UseControlSetup<V> = ControlSetup<V> & {
  /**
   * Use this control instead of creating one.
   *
   * For components that accept an optional `control` prop and otherwise
   * manage their own: `props.control ?? useControl(…)` is a conditional hook
   * call, which `react-hooks/rules-of-hooks` rejects (as an error in this
   * repo). Passing it here keeps the call unconditional.
   *
   * No control is created while this is supplied, and none is wasted if it is
   * later withdrawn — the internal one is created on demand at that point,
   * from the `initialValue` originally passed.
   */
  use?: Control<V>;
};

/**
 * A `Control` owned by this component, created once and stable for its
 * lifetime.
 *
 * Mirrors `useState`'s shape: pass a value, or a function to compute one
 * lazily. As with `useState`, a `V` that is itself a function must be wrapped
 * in an initializer, since the two are told apart by `typeof`.
 *
 * ```tsx
 * const name = useControl("");
 * const { rc, rendered } = useControls();
 * return rendered(<input value={rc.getValue(name)} … />);
 * ```
 *
 * `setup` is read only when the control is created — a validator or `meta`
 * changed on a later render has no effect.
 *
 * Creating a control does not subscribe to it. Read through an `rc` from
 * {@link useControls} to re-render on its changes.
 */
export function useControl<V>(
  initialValue: V | (() => V),
  setup?: UseControlSetup<V>,
): Control<V>;
/** Create a control of the given type, initially `undefined`. */
export function useControl<V = undefined>(): Control<V | undefined>;
export function useControl<V>(
  initialValue?: V | (() => V),
  setup?: UseControlSetup<V>,
): Control<V> {
  const ctx = useControlContext();
  const supplied = setup?.use;

  // `useRef` rather than `useMemo`: React may discard and re-run a `useMemo`
  // factory (it is a cache, not a guarantee), and StrictMode's double render
  // would then hand back a different control than the one already in use.
  const ref = useRef<Control<V> | null>(null);
  if (!supplied && !ref.current) {
    const initial =
      typeof initialValue === "function"
        ? (initialValue as () => V)()
        : (initialValue as V);
    ref.current = ctx.newControl(initial, setup);
  }
  return supplied ?? (ref.current as Control<V>);
}
