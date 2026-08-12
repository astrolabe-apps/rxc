"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Control, ControlContext, ReadContext } from "@rxc/controls-core";
import { computed } from "@rxc/controls-core";
import type { ComputedRef } from "@rxc/controls-core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
  setFinalizedReadHook,
} from "@rxc/controls-core/internal";
import type { Controls, Rendered } from "./types";

// ── React Context ───────────────────────────────────────────────────

const ControlContextReact = createContext<ControlContext | null>(null);

export function ControlContextProvider({
  value,
  children,
}: {
  value: ControlContext;
  children: React.ReactNode;
}) {
  return (
    <ControlContextReact.Provider value={value}>
      {children}
    </ControlContextReact.Provider>
  );
}

export function useControlContext(): ControlContext {
  const ctx = useContext(ControlContextReact);
  if (!ctx)
    throw new Error(
      "useControlContext: no ControlContext found. Wrap your app in <ControlContextProvider>.",
    );
  return ctx;
}

// ── Dev guard ───────────────────────────────────────────────────────

const warnedSites = new Set<string>();
declare const process: { env: { NODE_ENV?: string } } | undefined;

/**
 * True only when a development build can be positively confirmed.
 *
 * Two requirements, and both matter:
 *
 * 1. The reference must be the **literal** `process.env.NODE_ENV`. Bundlers
 *    (webpack/Next `DefinePlugin`, esbuild, vite) statically replace exactly
 *    that member expression, which folds this to `false` and lets the dev-only
 *    work below be dead-code eliminated. Optional chaining
 *    (`process?.env?.NODE_ENV`) is **not** matched — an earlier version used it,
 *    so webpack injected a `process` browser shim instead and this evaluated to
 *    `true` in production bundles: a stack capture per mounted component plus
 *    warnings with minified names in consumers' consoles.
 * 2. The `typeof` guard, so an unbundled browser ESM load (where `process` is
 *    an undeclared identifier) yields `false` rather than a `ReferenceError` on
 *    every mount. Evaluated **once at module scope**, so even where a bundler
 *    doesn't fold it the cost is one check per module rather than per render.
 *
 * Anything undeterminable is treated as production: a library must not pay
 * dev-only costs when it cannot prove it is in dev.
 */
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * Identify the component that called `useControls`, for the dev warning below.
 *
 * Captured **during render**, once per component instance, because that is the
 * only moment the component is on the stack — the warning itself fires from a
 * passive effect, by which point the stack is React's commit machinery. (React
 * 19's `captureOwnerStack()` does work from an effect, but reports the
 * component's *owner*, not the component, so it can't name the offender.)
 *
 * Frame 0 is `Error`, frame 1 is `useControls`, frame 2 is normally the
 * component. If a consumer wraps `useControls` in a hook of their own, frame 2
 * is that hook, so scan a few frames for the first PascalCase name — the
 * component naming convention — and fall back to frame 2 verbatim.
 */
function captureCallSite(): string {
  const frames = (new Error().stack ?? "").split("\n").slice(2, 8);
  for (const frame of frames) {
    const name = /^\s*at\s+([A-Z]\w*)\s/.exec(frame)?.[1];
    if (name) return `${name} (${/\(([^)]+)\)/.exec(frame)?.[1] ?? "?"})`;
  }
  return frames[0]?.replace(/^\s*at\s+/, "") ?? "(unknown component)";
}

/**
 * Warn once per call site when a component body returns without calling
 * `rendered(…)` — its reads were tracked but never subscribed, so it will not
 * re-render. This is the net for cases the `Rendered` return type can't catch,
 * notably files outside `tsconfig`'s `include` (tests).
 */
function warnMissingRendered(site: string): void {
  if (!IS_DEV || warnedSites.has(site)) return;
  warnedSites.add(site);
  // eslint-disable-next-line no-console
  console.error(
    `[@rxc/controls] ${site} returned without calling rendered(…). ` +
      `Everything it read through \`rc\` was tracked but never subscribed, so ` +
      `this component will not re-render when those controls change. Wrap ` +
      `EVERY return path — including early returns like ` +
      `\`if (!c.data) return rendered(null)\`.`,
  );
}

// ── Wrong-rc guard ──────────────────────────────────────────────────

/**
 * The rc whose render window is currently open, or `null` between renders.
 *
 * Only one can be open at a time: React renders one component at a time, and
 * a parent's `rendered(…)` runs before any of its children begin, so windows
 * never overlap.
 */
let openRc: TrackingReadContext | null = null;

/**
 * Warn when a callback reads through an enclosing component's `rc` instead of
 * the one it was handed.
 *
 * The read itself is harmless — {@link TrackingReadContext} drops it rather
 * than corrupting anyone's subscription set — but nothing subscribes, so the
 * value silently stops updating. The naming convention (call the parameter
 * `rc`, so it shadows) prevents this outright; this catches the cases that
 * opt out of it by renaming.
 *
 * The discriminator is *when*, not *what*: a finalized read while some other
 * rc's window is open can only be a captured context, because legitimate
 * finalized reads (event handlers, refs, effects) all happen with no render
 * in progress.
 */
function warnWrongRc(): void {
  const site = captureCallSite();
  if (warnedSites.has(site)) return;
  warnedSites.add(site);
  // eslint-disable-next-line no-console
  console.error(
    `[@rxc/controls] ${site} read through a ReadContext belonging to an ` +
      `enclosing component, whose render pass has already closed. The read ` +
      `returned a current value but subscribed to nothing, so this will not ` +
      `re-render when that control changes. Use the \`rc\` the callback was ` +
      `given — naming the parameter \`rc\` shadows the outer one and makes ` +
      `this impossible.`,
  );
}

if (IS_DEV) {
  setFinalizedReadHook((rc) => {
    if (openRc !== null && openRc !== rc) warnWrongRc();
  });
}

// ── useControls ─────────────────────────────────────────────────────

interface Tracker {
  rc: TrackingReadContext;
  reconciler: SubscriptionReconciler;
  controls: Controls;
  didRender: boolean;
  /** Component identity for the dev warning; "" in production. */
  site: string;
}

/**
 * Reactive reads for a component.
 *
 * ```tsx
 * function StarsRenderer({ node, id }: DataRendererProps): Rendered {
 *   const { rc, rendered } = useControls();
 *   const c = useTextInputController(rc, node);
 *   if (!c.data) return rendered(null);
 *   return rendered(<input value={c.value} onChange={…} />);
 * }
 * ```
 *
 * Every read through `rc` during this render is tracked; `rendered(…)` turns
 * that set into live subscriptions and closes the tracking window. The
 * component re-renders when any of them changes.
 */
export function useControls(): Controls {
  const controlContext = useControlContext();
  const [, forceRender] = useState(0);

  const ref = useRef<Tracker | null>(null);
  if (!ref.current) {
    const rc = new TrackingReadContext();
    const reconciler = new SubscriptionReconciler();
    reconciler.setListener(() => forceRender((c) => c + 1));
    const tracker: Tracker = {
      rc,
      reconciler,
      didRender: false,
      site: IS_DEV ? captureCallSite() : "",
      controls: {
        rc,
        rendered: (node) => {
          tracker.didRender = true;
          // Reconcile during render, not in an effect: between the body and a
          // passive effect the component would sit on screen with no
          // subscriptions at all. See the rejected alternatives in
          // docs/RENDER-BOUNDARY.md.
          reconciler.reconcile(rc.tracked);
          // Close the render window. Later reads through this rc (event
          // handlers, refs, escaped proxies) still return current values but
          // no longer register dependencies that nothing would reconcile.
          rc.finalize();
          if (IS_DEV && openRc === rc) openRc = null;
          return node as unknown as Rendered;
        },
      },
    };
    ref.current = tracker;
  }
  const tracker = ref.current;

  // Open this render's tracking window.
  tracker.rc.reset();
  tracker.didRender = false;
  if (IS_DEV) openRc = tracker.rc;

  // Alive/dead lifecycle. Stable deps — mount/unmount only, so an abandoned
  // render's subscriptions are swept rather than left live.
  useEffect(() => {
    controlContext.reviveTracker(tracker.reconciler);
    return () => {
      controlContext.markTrackerDead(tracker.reconciler);
    };
  }, [controlContext, tracker]);

  // Guard: runs after every commit. A component that threw never commits its
  // effects, so this cannot cry wolf on a caught error.
  useEffect(() => {
    if (!tracker.didRender) warnMissingRendered(tracker.site);
    // A component that threw (or returned without `rendered(…)`) never closed
    // its window, which would leave `openRc` stale and make the next
    // legitimate handler read look like a captured context. Effects run after
    // commit, when no render is in progress, so clearing here is always safe
    // and bounds the staleness to a single pass.
    if (IS_DEV) openRc = null;
  });

  return tracker.controls;
}

// ── useComputed ─────────────────────────────────────────────────────

/**
 * A `Control` whose value is derived from other controls.
 *
 * The computation re-runs whenever anything it read through its own `rc`
 * changes. Read the result through your component's `rc` to re-render on it.
 */
export function useComputed<V>(compute: (rc: ReadContext) => V): Control<V> {
  const ctx = useControlContext();
  const ref = useRef<{ control: Control<V>; reconciler: ComputedRef } | null>(
    null,
  );
  if (!ref.current) {
    const control: Control<V> = ctx.newControl<V>(undefined as V);
    const reconciler = computed(ctx, control, compute);
    ref.current = { control, reconciler };
  } else {
    ref.current.reconciler.replaceCompute(compute);
  }
  const { reconciler } = ref.current;

  useEffect(() => {
    ctx.reviveTracker(reconciler);
    return () => ctx.markTrackerDead(reconciler);
  }, [ctx, reconciler]);

  return ref.current.control;
}
