"use client";

/**
 * Bridge 1's React face — the pair that keeps the legacy SWC/Babel tracking
 * plugin working. The plugin transforms every component into:
 *
 * ```js
 * var _stop = useComponentTracking();
 * try { …original body… } finally { _stop(); }
 * ```
 *
 * `useComponentTracking()` opens an ambient collection window for the render
 * body; `stop()` closes it and reconciles the collected `(control, bits)`
 * reads into live subscriptions — synchronous with render, the same law
 * `useControls`/`rendered(…)` obeys (docs/RENDER-BOUNDARY.md).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FC } from "react";
import { ControlChange } from "@rxc/controls-core";
import {
  SubscriptionReconciler,
  toImpl,
  type ControlImpl,
} from "@rxc/controls-core/internal";
import type { Control as CoreControl } from "@rxc/controls-core";
import { useControlContext } from "@rxc/controls";
import { collectChange, setChangeCollector } from "./ambient";
import type { ChangeListenerFunc } from "./types";

interface Tracker {
  map: Map<ControlImpl, ControlChange>;
  reconciler: SubscriptionReconciler;
  collector: ChangeListenerFunc<any>;
  prev: ChangeListenerFunc<any> | undefined;
  open: boolean;
}

/**
 * Track ambient control reads for this component's render pass.
 *
 * Call at the top of the component (or let the tracking plugin inject it);
 * call the returned `stop` on every return path. Reads through the patched
 * getters between the two subscribe the component, and it re-renders when
 * any of them changes.
 */
export function useComponentTracking(): () => void {
  const ctx = useControlContext();
  const [, forceRender] = useState(0);

  const ref = useRef<Tracker | null>(null);
  if (!ref.current) {
    const map = new Map<ControlImpl, ControlChange>();
    const reconciler = new SubscriptionReconciler();
    reconciler.setListener(() => forceRender((c) => c + 1));
    const tracker: Tracker = {
      map,
      reconciler,
      prev: undefined,
      open: false,
      collector: (c, change) => {
        const impl = toImpl(c as unknown as CoreControl<unknown>);
        map.set(impl, (map.get(impl) ?? ControlChange.None) | change);
      },
    };
    ref.current = tracker;
  }
  const tracker = ref.current;

  // Open this render's collection window.
  tracker.map.clear();
  tracker.prev = collectChange;
  setChangeCollector(tracker.collector);
  tracker.open = true;

  // Alive/dead lifecycle across StrictMode remounts — mount/unmount only.
  useEffect(() => {
    ctx.reviveTracker(tracker.reconciler);
    return () => ctx.markTrackerDead(tracker.reconciler);
  }, [ctx, tracker]);

  // Safety net: a component that threw (or never called stop) would leave
  // the global collector pointed at a dead render. Effects run post-commit,
  // when no render is in progress, so closing here is always safe.
  useEffect(() => {
    if (tracker.open) {
      setChangeCollector(tracker.prev);
      tracker.open = false;
    }
  });

  return () => {
    if (!tracker.open) return;
    setChangeCollector(tracker.prev);
    tracker.open = false;
    tracker.reconciler.reconcile(tracker.map);
  };
}

/**
 * Wrap a render function so its ambient reads are tracked — the manual
 * counterpart of the compile-time plugin, for dynamically created
 * components.
 */
export function useTrackedComponent<A>(f: FC<A>, deps: unknown[]): FC<A> {
  // The callback *is* a component: the hook call inside runs in its render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback<FC<A>>((a) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const stop = useComponentTracking();
    try {
      return f(a);
    } finally {
      stop();
    }
  }, deps);
}
