"use client";

import { useEffect, useRef } from "react";
import { ControlChange } from "@rx-controls/core";
import type { ReadContext } from "@rx-controls/core";
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
 * ## This is a side-effect hook, not a derivation hook
 *
 * The guarantee is that `onChange` runs with the new value — **not when**.
 * Batching, an enclosing write that is still open, and coalescing all move
 * the moment legitimately, so nothing should be built on the timing. Use it
 * for things that genuinely are effects: saving, fetching, navigating.
 *
 * To *derive* a value, derive it rather than observing-and-writing —
 * {@link useComputed} runs during render, so the result is ready before the
 * first paint and there is no window in which it is stale. Where the derived
 * value has to live in a control something else also writes, write it from a
 * render body (`update` from {@link useReactive}) or from a core `effect`.
 *
 * ## `getElements` registers a dependency on structure, not contents
 *
 * A compute that reads `rc.getElements(c)` depends on the element list, so
 * replacing an array with a **same-length** array changes no element
 * identities and re-runs nothing at all. Read the values —
 * `rc.getElements(c).map((e) => rc.getValue(e))` — to depend on contents.
 * (`@react-typed-forms/core@4` behaved the same way.)
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

  // The last value this hook has accounted for, seeded during the render that
  // creates the computed — see the catch-up below for why that matters. The
  // effect re-reads the same box, which is only ever assigned once.
  const lastSeenRef = useRef<{ v: V } | null>(null);
  lastSeenRef.current ??= { v: result.valueNow };

  useEffect(() => {
    const lastSeen = (lastSeenRef.current ??= { v: result.valueNow });
    const deliver = () => {
      lastSeen.v = result.valueNow;
      onChangeRef.current(result.valueNow);
    };
    if (!didInitial.current) {
      didInitial.current = true;
      const init = initialRef.current;
      const fn =
        typeof init === "function" ? init : init ? onChangeRef.current : null;
      if (fn) {
        lastSeen.v = result.valueNow;
        fn(result.valueNow);
      }
    }
    const sub = result.subscribe(deliver, ControlChange.Value);
    // The computed recomputes whether or not anyone is subscribed, so a write
    // landing between the render that created it and this effect is absorbed
    // with nobody to tell — and nothing ever replays it. That window is not
    // theoretical: React runs effects child-first, so any descendant effect
    // writing a watched control at mount falls inside it, as does a write from
    // a layout effect or a render body. Comparing against the value we last
    // accounted for closes it, and costs a reference check otherwise: the
    // computed's target only takes a new reference when `setValue` decided the
    // value actually changed, so `!==` is exactly "a change was published".
    if (lastSeen.v !== result.valueNow) deliver();
    return () => result.unsubscribe(sub);
  }, [result]);
}
