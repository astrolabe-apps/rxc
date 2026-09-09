"use client";

import { useEffect, useRef } from "react";
import { ControlChange } from "@rxc/controls-core";
import type { ReadContext } from "@rxc/controls-core";
import { useComputed } from "./useReactive.js";

/**
 * Run a side effect when a computed value changes.
 *
 * `compute` reads through its **own** `rc` (like {@link useComputed}, which
 * this is built on), so the values it depends on do not re-render the
 * component — the only consequence of a change is `onChange` running. Reading
 * the same controls through the component's `rc` as well is fine; the two
 * subscriptions are independent.
 *
 * ```tsx
 * useControlEffect(
 *   (rc) => rc.getValue(form.fields.query),
 *   (query) => saveSearch(query),
 * );
 * ```
 *
 * `onChange` fires only when the computed value actually *changes* per the
 * tree's equality (`ControlContext.equals`) — recomputations that produce an
 * equal value are silent. It always receives the latest `onChange` passed to
 * the hook, so closures over current props/state are safe.
 *
 * @param compute Computes the watched value; reads through `rc` are tracked.
 * @param onChange Runs with the new value after it changes.
 * @param initial Controls the mount-time call: a function is called once with
 *   the initially computed value, `true` calls `onChange` instead, and
 *   omitted/`false` means nothing runs until the first real change.
 */
export function useControlEffect<V>(
  compute: (rc: ReadContext) => V,
  onChange: (value: V) => void,
  initial?: ((value: V) => void) | boolean,
): void {
  const result = useComputed(compute);

  // Always call the latest callback — never a stale closure from the render
  // that happened to create the subscription.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // `initial` is mount-time semantics; changing it later has no meaning.
  const initialRef = useRef(initial);
  // Persists across StrictMode's unmount/remount, so the initial call fires
  // once per real mount rather than once per effect invocation.
  const didInitial = useRef(false);

  useEffect(() => {
    if (!didInitial.current) {
      didInitial.current = true;
      const init = initialRef.current;
      const fn =
        typeof init === "function" ? init : init ? onChangeRef.current : null;
      fn?.(result.valueNow);
    }
    const sub = result.subscribe(
      () => onChangeRef.current(result.valueNow),
      ControlChange.Value,
    );
    return () => result.unsubscribe(sub);
  }, [result]);
}
