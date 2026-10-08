import { useEffect, useLayoutEffect } from "react";

/** React Native identifies itself here; it has no `document`. */
export const isReactNative: boolean =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";

/**
 * Run `fn` once what has just committed is on screen. On the web a commit is
 * already in the DOM. React Native mounts it on its UI thread after the
 * commit, so a focus sent at once reaches a view not yet shown — a tab panel
 * just revealed — and is lost; a frame later it is there.
 */
export function afterMount(fn: () => void): void {
  if (isReactNative) requestAnimationFrame(() => fn());
  else fn();
}

/** `useLayoutEffect` on the client (a DOM, or React Native), `useEffect` on the server. */
export const useCommitEffect =
  typeof document !== "undefined" ||
  // React Native has layout effects but no `document`; it identifies itself here.
  (typeof navigator !== "undefined" && navigator.product === "ReactNative")
    ? useLayoutEffect
    : useEffect;
