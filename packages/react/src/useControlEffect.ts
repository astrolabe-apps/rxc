"use client";

import { useEffect, useRef } from "react";
import { effect, untrackedRead } from "@rx-controls/core";
import type { EffectHandle, ReadContext } from "@rx-controls/core";
import { useControlContext } from "./useReactive.js";

/**
 * Everything the hook owns across renders. One object in a ref, so the effect
 * body can close over it once and still see the freshest `compute` /
 * `onChange` the component rendered with.
 */
interface Watch<V> {
  /** Latest `compute`, reassigned every render. */
  compute: (rc: ReadContext) => V;
  /** Latest `onChange`, reassigned every render — never a stale closure. */
  onChange: (value: V) => void;
  /** Mount-time semantics, captured once; changing it later has no meaning. */
  initial: ((value: V) => void) | boolean | undefined;
  /**
   * The value `onChange` was last told about — the whole ledger this hook
   * keeps. Every question it has to answer ("was that a change?", "did I miss
   * one while I wasn't subscribed?") is this one comparison.
   */
  last: V;
  /** Survives StrictMode's unmount/remount, so `initial` fires once per real
   * mount rather than once per effect invocation. */
  didInitial: boolean;
  /** Live only between the effect below and its cleanup. */
  handle: EffectHandle | undefined;
}

/**
 * Run a side effect when a computed value changes.
 *
 * `compute` reads through its **own** `rc`, so the values it depends on do not
 * re-render the component — the only consequence of a change is `onChange`
 * running. Reading the same controls through the component's `rc` as well is
 * fine; the two subscriptions are independent.
 *
 * ```tsx
 * useControlEffect(
 *   (rc) => rc.getValue(form.fields.query),
 *   (query) => saveSearch(query),
 * );
 * ```
 *
 * The contract: when the computed value changes per the tree's equality
 * (`ControlContext.equals`, `deepEquals` by default), `onChange` runs **once,
 * eventually, with the latest value**, and does not run again until another
 * such change. "Eventually" is deliberately loose — a change may be delivered
 * inline with the write that caused it or from a commit effect, whichever the
 * situation calls for. `onChange` always receives the latest callback passed
 * to the hook, so closures over current props/state are safe.
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
 * ## `compute` re-runs every render unless you memoize it
 *
 * A `compute` may close over things the reactive graph cannot observe — props,
 * component state — so a new `compute` identity re-runs it. An inline arrow
 * has a new identity every render, which is what makes those reads work.
 *
 * Wrapping `compute` in `useCallback` opts out: it then re-runs only when a
 * tracked control changes. Worth doing for an expensive compute, with the
 * usual caveat that wrong deps leave you reading stale props.
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
  const ctx = useControlContext();

  const ref = useRef<Watch<V> | null>(null);
  ref.current ??= {
    compute,
    onChange,
    initial,
    didInitial: false,
    handle: undefined,
    // Seeded from render-time state, untracked: nothing is subscribed until
    // the effect below mounts. This is what makes a write landing in the
    // render→mount window a change rather than a missed one — the effect's
    // first run compares against it like any other run.
    last: compute(untrackedRead),
  };
  const s = ref.current;
  // The freshest closures, always. Reading them costs nothing and re-runs
  // nothing; re-running is the next effect's decision.
  s.compute = compute;
  s.onChange = onChange;

  // A new `compute` identity means its captured closure moved (props, state),
  // which the reactive graph has no way to observe. Re-run so both the watched
  // value and the tracked dependency set follow.
  //
  // Declared *before* the effect below, and that ordering is load-bearing:
  // React runs every cleanup, then every effect, in hook order. On mount
  // `s.handle` does not exist yet so this no-ops — the effect's own first run
  // already used the current compute. When `ctx` changes, the effect's cleanup
  // has cleared `s.handle` before this runs, so it no-ops there too and the
  // recreated effect does the comparison instead.
  useEffect(() => {
    s.handle?.rerun();
    // `compute` identity is deliberately the only trigger. Listing `s.handle`
    // would re-run this whenever the effect below is recreated, which is
    // exactly the case the ordering above already covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compute]);

  useEffect(() => {
    let first = true;
    const handle = effect(ctx, (rc) => {
      const value = s.compute(rc);
      if (first) {
        first = false;
        // The mount-time call, once per real mount. It reports the live value,
        // so a change absorbed in the render→mount window is accounted for
        // rather than reported a second time by the comparison below.
        if (!s.didInitial) {
          s.didInitial = true;
          const init = s.initial;
          const fn =
            typeof init === "function" ? init : init ? s.onChange : null;
          if (fn) {
            s.last = value;
            fn(value);
            return;
          }
        }
      }
      if (ctx.equals(value, s.last)) return;
      s.last = value;
      s.onChange(value);
    });
    s.handle = handle;
    return () => {
      s.handle = undefined;
      handle.cleanup();
    };
  }, [ctx, s]);
}
