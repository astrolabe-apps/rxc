"use client";

import { useEffect, useRef } from "react";

/**
 * Schedule a cleanup that survives React Strict Mode's dev double-mount.
 *
 * React 18 Strict Mode runs every effect twice in dev: mount → commit →
 * cleanup → mount → commit. If a hook needs to release expensive
 * resources on unmount AND that release would invalidate in-flight async
 * work kicked off by the first commit, a plain synchronous cleanup tears
 * everything down before the work completes — see the runAsync /
 * Jsonata-eval interplay in `useFormStateNode` for a concrete case.
 *
 * The fix is to defer the cleanup behind a microtask and let the
 * re-mount cancel it before it fires. Real unmounts (when no re-mount
 * follows) let the microtask run and the cleanup proceeds as expected.
 *
 * The supplied `cleanup` is captured by ref so consumers can pass a
 * fresh closure each render without forcing the effect to re-run.
 *
 * @example
 * const slotRef = useRef<Thing | null>(null);
 * useDeferredCleanup(() => {
 *   slotRef.current?.dispose();
 *   slotRef.current = null;
 * });
 */
export function useDeferredCleanup(cleanup: () => void): void {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  const pendingRef = useRef<{ cancelled: boolean } | null>(null);

  useEffect(() => {
    // Strict-mode re-mount: a teardown queued by the immediately
    // preceding cleanup is still pending — flag it cancelled so its
    // microtask becomes a no-op when it fires.
    if (pendingRef.current) {
      pendingRef.current.cancelled = true;
      pendingRef.current = null;
    }
    return () => {
      const token = { cancelled: false };
      pendingRef.current = token;
      queueMicrotask(() => {
        if (token.cancelled) return;
        pendingRef.current = null;
        cleanupRef.current();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
