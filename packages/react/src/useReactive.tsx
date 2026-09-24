"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { computeInto, untrackedRead } from "@rx-controls/core";
import type { ComputedHandle } from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
  addEscapedReadHook,
} from "@rx-controls/core/internal";
import type { ReactiveScope, Rendered } from "./types.js";

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
 * Identify the component that called `useReactive`, for the dev warning below.
 *
 * Captured **during render**, once per component instance, because that is the
 * only moment the component is on the stack — the warning itself fires from a
 * passive effect, by which point the stack is React's commit machinery. (React
 * 19's `captureOwnerStack()` does work from an effect, but reports the
 * component's *owner*, not the component, so it can't name the offender.)
 *
 * Frame 0 is `Error`, frame 1 is `useReactive`, frame 2 is normally the
 * component. If a consumer wraps `useReactive` in a hook of their own, frame 2
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
    `[@rx-controls/react] ${site} returned without calling rendered(…). ` +
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
 *
 * Maintained in production as well as dev — the deferred-notification policy
 * below reads it, not just the wrong-rc guard.
 */
let openRc: TrackingReadContext | null = null;

/**
 * How {@link reportWrongRc} reacts. `"warn"` by default; a diagnostics layer
 * hunting a staleness bug can raise it to `"throw"` so the stack points
 * straight at the offending read. Dev-only — the hook that calls it is
 * installed behind `IS_DEV`.
 */
export type WrongRcSeverity = "warn" | "throw";

let wrongRcSeverity: WrongRcSeverity = "warn";

/** Set how a captured-`rc` read is reported. See {@link WrongRcSeverity}. */
export function setWrongRcSeverity(severity: WrongRcSeverity): void {
  wrongRcSeverity = severity;
}

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
 *
 * Reported as a warning by default; {@link setWrongRcSeverity} raises it to a
 * throw for a diagnostics session.
 */
function reportWrongRc(): void {
  const site = captureCallSite();
  // Throwing is opt-in and meant to be caught on the first occurrence, so it
  // is not deduplicated — only the warning is.
  if (wrongRcSeverity !== "throw") {
    if (warnedSites.has(site)) return;
    warnedSites.add(site);
  }
  const message =
    `[@rx-controls/react] ${site} read through a ReadContext belonging to an ` +
    `enclosing component, whose render pass has already closed. The read ` +
    `returned a current value but subscribed to nothing, so this will not ` +
    `re-render when that control changes. Use the \`rc\` the callback was ` +
    `given — naming the parameter \`rc\` shadows the outer one and makes ` +
    `this impossible.`;
  if (wrongRcSeverity === "throw") throw new Error(message);
  // eslint-disable-next-line no-console
  console.error(message);
}

if (IS_DEV) {
  addEscapedReadHook((rc) => {
    if (openRc !== null && openRc !== rc) reportWrongRc();
  });
}

// ── Deferred notification ───────────────────────────────────────────
//
// Writing controls from a render body is supported (it is the Case-B
// "adjust derived state during render" shape). The write applies
// immediately, so the rest of the writer's body and every descendant that
// has yet to render sees the new value with no further ceremony.
//
// Notification is the part that needs care, and it splits in two:
//
//   * **The writer itself.** Its own subscriptions are live from its second
//     render onwards (`reconcile()` only runs at `rendered(…)`, so the
//     previous pass's set is still in place while the body runs), so the
//     flush calls its `forceRender`. That lands on the *currently rendering*
//     fiber, which is React's blessed render-phase update: React discards the
//     output and re-invokes the component immediately, with no intervening
//     commit. Exactly the cost React charges for its own
//     `if (items !== prev) setState(…)`, and a write that fails to converge
//     trips "Too many re-renders" — which is the correct diagnostic. Left
//     alone deliberately.
//
//   * **Everybody else.** A component that has already committed gets
//     `forceRender` called on a *different* fiber mid-render, which React
//     rejects with "Cannot update a component while rendering a different
//     component" and then services as a separate scheduled pass. That is the
//     one genuine problem, and it is what the queue below fixes: such a
//     notification is held until the render phase is over, then delivered in
//     the commit phase (before paint), with a microtask backstop. See
//     `deferRender` for why it is drained from two places.
//
//   * **Anybody who has not committed yet.** A tracker subscribes at
//     `rendered(…)`, during render, so between that moment and the fiber's
//     first commit it is reachable by a write and React will reject
//     `forceRender` on it: "Can't perform a React state update on a component
//     that hasn't mounted yet". The `openRc` test above cannot see this case,
//     because the writes that hit it come from *outside* the render phase —
//     a layout-effect cleanup running in React's deletion pass (an unmounting
//     subtree clearing the errors it published, while its replacement has
//     rendered but not yet been placed), or any write after a render that
//     never committed (a suspend). Such a notification is held in the same
//     queue until the tracker's own commit effect, which is the first moment
//     the fiber is mounted; it re-renders then, before paint. A tracker whose
//     render is abandoned for good stays queued and inert — the same memory
//     cost as its orphaned subscriptions, and nothing else.
//
// Only notification moves. Values are never staged.

const deferred = new Set<Tracker>();
let drainScheduled = false;

function drainDeferred(): void {
  drainScheduled = false;
  if (deferred.size === 0) return;
  // Snapshot: a render triggered here can enqueue further trackers, which
  // belong to the next drain rather than this one.
  for (const t of [...deferred]) {
    // Not yet committed: React would warn, and there is no mounted output to
    // refresh. Its own commit effect drains it the moment that changes.
    if (!t.mounted) continue;
    deferred.delete(t);
    t.forceRender();
  }
}

/**
 * Queue `tracker` for a re-render once the render phase is over.
 *
 * Drained from two places, in this order of preference:
 *
 *  1. **The commit phase**, by the layout effect `useReactive` already
 *     registers per component. This is the path that normally runs: it is
 *     after DOM mutation but before paint, so the deferred component never
 *     shows a stale frame, and it sits inside React's own work — which keeps
 *     it inside a synchronous `act()` in tests rather than producing "an
 *     update … was not wrapped in act(...)".
 *  2. **A microtask**, as the backstop for a render that never commits
 *     (an abandoned concurrent render, a throw). Without it those
 *     notifications would strand and the observer would stay stale
 *     indefinitely. It normally finds the queue already empty and does
 *     nothing. Draining from a microtask is legal: React's "during render"
 *     check keys off the fiber being rendered *synchronously*, which is
 *     never the case in a microtask.
 *
 * Either drain skips a tracker whose component has not committed yet; that
 * one waits for its own commit effect, which runs the drain as well.
 */
function deferRender(tracker: Tracker): void {
  deferred.add(tracker);
  if (drainScheduled) return;
  drainScheduled = true;
  queueMicrotask(drainDeferred);
}

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * React warns that layout effects do nothing during SSR, and in this repo
 * anything on stderr fails `rush test`. Neither of this effect's jobs
 * matters on the server: nothing has committed, so there is nothing queued
 * to drain, and `openRc` is overwritten by the next `beginTracking()`.
 */
export const useCommitEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

// ── useReactive ─────────────────────────────────────────────────────

interface Tracker {
  rc: TrackingReadContext;
  reconciler: SubscriptionReconciler;
  controls: ReactiveScope;
  didRender: boolean;
  /**
   * Set at the first commit effect and never cleared. Until then the fiber
   * has rendered — so it has subscriptions and a `forceRender` — but is not
   * mounted, and React rejects a state update from anyone but itself.
   */
  mounted: boolean;
  /** Stable re-render trigger — `useState`'s setter is stable for the
   * component's life, so the queue can hold this across renders. */
  forceRender: () => void;
  /** Component identity for the dev warning; "" in production. */
  site: string;
}

/**
 * Reactive reads for a component.
 *
 * ```tsx
 * function StarsRenderer({ node, id }: DataRendererProps): Rendered {
 *   const { rc, rendered } = useReactive();
 *   const c = useTextInputController(rc, node);
 *   if (!c.data) return rendered(null);
 *   return rendered(<input value={c.value} onChange={…} />);
 * }
 * ```
 *
 * Every read through `rc` during this render is tracked; `rendered(…)` turns
 * that set into live subscriptions and closes the tracking window. The
 * component re-renders when any of them changes.
 *
 * `update` comes along for the write side, so a component that reads and
 * writes needs no separate {@link useControlContext} call.
 */
export function useReactive(): ReactiveScope {
  const controlContext = useControlContext();
  const [, forceRender] = useState(0);

  const ref = useRef<Tracker | null>(null);
  if (!ref.current) {
    const rc = new TrackingReadContext();
    const reconciler = new SubscriptionReconciler();
    const tracker: Tracker = {
      rc,
      reconciler,
      didRender: false,
      mounted: false,
      forceRender: () => forceRender((c) => c + 1),
      site: IS_DEV ? captureCallSite() : "",
      controls: {
        rc,
        // Reassigned below on every render, so a swapped provider is picked
        // up rather than frozen at first mount.
        update: controlContext.update,
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
          // This pass read current values, so any re-render queued for us
          // while an ancestor was rendering is now redundant. Covers the
          // common case: an ancestor writes during its render and we render
          // afterwards in the same pass.
          deferred.delete(tracker);
          if (openRc === rc) openRc = null;
          return node as unknown as Rendered;
        },
      },
    };
    // Installed here rather than at construction because it closes over
    // `tracker`. See "Deferred notification" above for the two branches.
    reconciler.setListener(() => {
      // The writer itself: React's render-phase update, taken at once.
      if (openRc === rc) tracker.forceRender();
      // Anyone else waits while a render is in progress, and until it has
      // committed for the first time.
      else if (openRc !== null || !tracker.mounted) deferRender(tracker);
      else tracker.forceRender();
    });
    ref.current = tracker;
  }
  const tracker = ref.current;
  tracker.controls.update = controlContext.update;

  // Open this render's tracking window.
  tracker.rc.beginTracking();
  tracker.didRender = false;
  openRc = tracker.rc;

  // Alive/dead lifecycle. Stable deps, so this is mount/unmount only.
  //
  // Note what it does *not* cover: a render that reconciles and then never
  // commits (React abandoning a concurrent pass, a sibling throwing) never
  // runs this effect, so `releaseTracker` is never called and the sweep — which
  // only ever looks at trackers that were released — cannot collect it. Those
  // subscriptions stay on their controls for the life of the tree. They are
  // inert (`forceRender` on a fiber that never mounted does nothing), so the
  // cost is memory, not renders or CPU. `useComputed` avoids the same trap by
  // not subscribing until commit; this one cannot, because `rendered(…)` has to
  // reconcile during render — see docs/RENDER-BOUNDARY.md.
  useEffect(() => {
    controlContext.retainTracker(tracker.reconciler);
    return () => {
      controlContext.releaseTracker(tracker.reconciler);
      // Nothing left to refresh; a stale entry would only pin the tracker.
      deferred.delete(tracker);
    };
  }, [controlContext, tracker]);

  // Runs after every commit, before paint. A component that threw never
  // commits its effects, so the guard below cannot cry wolf on a caught
  // error.
  useCommitEffect(() => {
    // From here on a notification may reach this fiber directly.
    tracker.mounted = true;
    // Primary drain for deferred notifications — see "Deferred notification".
    // Cheap when empty, which is the overwhelmingly common case.
    drainDeferred();
    if (!tracker.didRender) warnMissingRendered(tracker.site);
    // A component that threw (or returned without `rendered(…)`) never closed
    // its window, which would leave `openRc` stale — making the next
    // legitimate handler read look like a captured context, and deferring
    // notifications that should have fired at once. This runs after commit,
    // when no render is in progress, so clearing here is always safe and
    // bounds the staleness to a single pass.
    openRc = null;
  });

  return tracker.controls;
}

// ── useComputed ─────────────────────────────────────────────────────

/**
 * Everything the hook owns across renders. One object in a ref, so the commit
 * effect can close over it once and still start from the freshest `compute`
 * the component rendered with.
 */
interface Derived<V> {
  control: Control<V>;
  /** Latest `compute`, reassigned every render. */
  compute: (rc: ReadContext) => V;
  /** Live only between the commit effect below and its cleanup. */
  handle: ComputedHandle | undefined;
}

/**
 * A `Control` whose value is derived from other controls.
 *
 * The computation re-runs whenever anything it read through its own `rc`
 * changes. Read the result through your component's `rc` to re-render on it.
 *
 * ```tsx
 * const full = useComputed((crc) => `${crc.getValue(first)} ${crc.getValue(last)}`);
 * return rendered(<span>{rc.getValue(full)}</span>);
 * ```
 *
 * ## What the control buys you
 *
 * Reading `compute(rc)` inline with the component's own `rc` would give the
 * same value — and re-render on every dependency change. The derived control
 * is a **filter**: the component subscribes to the result, so a dependency
 * that moves without moving the result costs no render at all. That is the
 * whole point of the hook, and the reason it cannot collapse into a plain
 * function call.
 *
 * ## `compute` re-runs every render unless you memoize it
 *
 * Same rule as {@link useControlEffect}: an inline arrow has a new identity
 * every render, which re-runs it, which is what lets it close over props the
 * reactive graph cannot observe. The cost is that a dependency change computes
 * twice — once when the tracker notices, once in the re-render that follows.
 * `useCallback` opts out and is worth it for an expensive computation, with
 * the usual caveat that wrong deps leave you reading stale props.
 */
export function useComputed<V>(compute: (rc: ReadContext) => V): Control<V> {
  const ctx = useControlContext();

  const ref = useRef<Derived<V> | null>(null);
  ref.current ??= {
    control: ctx.newControl<V>(undefined as V),
    compute,
    handle: undefined,
  };
  const s = ref.current;
  s.compute = compute;

  // The value has to be right for *this* render — the caller reads it on the
  // next line, so unlike a side-effect hook nothing here can wait for a
  // commit. Before the commit effect below has run there is no tracker to ask,
  // so compute untracked and write; after it, the tracker owns the value and a
  // new `compute` identity re-runs it.
  if (s.handle) s.handle.replaceCompute(compute);
  else ctx.update((wc) => wc.setValue(s.control, compute(untrackedRead)));

  // Tracking starts at commit, not during render. A render that never commits
  // — React abandoning a concurrent pass, a sibling throwing, a suspend — then
  // leaves behind an unreferenced control and nothing else, rather than a live
  // subscription on every control the computation touched, recomputing forever
  // with no component to show it to.
  //
  // `computeInto` runs the computation as it subscribes, which is also what
  // closes the render→commit window: a descendant's layout effect runs before
  // this one (React commits child-first) and may have written a dependency
  // since the render body read it.
  //
  // A layout effect rather than a passive one, so the value is settled before
  // paint; `useCommitEffect` falls back to `useEffect` on the server, where
  // there is nothing to subscribe to and the untracked value above is final.
  useCommitEffect(() => {
    const handle = computeInto(ctx, s.control, s.compute);
    s.handle = handle;
    return () => {
      s.handle = undefined;
      handle.cleanup();
    };
  }, [ctx, s]);

  return s.control;
}

// ── withControlContext ─────────────────────────────────────────

/**
 * Wrap a component so it always renders under a given {@link ControlContext}.
 *
 * The HOC form of `<ControlContextProvider>`, for the cases where you own the
 * component but not its call site — a page/root exported to a framework
 * router, a component handed to a third-party host, or a test helper:
 *
 * ```tsx
 * export default withControlContext(Page, createControlContext());
 * ```
 *
 * The provider is inside the wrapper, so the wrapped component and everything
 * it renders see `controlsContext`, overriding any provider above it.
 */
export function withControlContext<P extends object>(
  Component: React.ComponentType<P>,
  controlsContext: ControlContext,
): React.FunctionComponent<P> {
  const Wrapped = (props: P) => (
    <ControlContextReact.Provider value={controlsContext}>
      <Component {...props} />
    </ControlContextReact.Provider>
  );
  Wrapped.displayName = `withControlContext(${
    Component.displayName ?? Component.name ?? "Component"
  })`;
  return Wrapped;
}
