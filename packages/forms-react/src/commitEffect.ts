import { useEffect, useLayoutEffect } from "react";

/** `useLayoutEffect` on the client (a DOM, or React Native), `useEffect` on the server. */
export const useCommitEffect =
  typeof document !== "undefined" ||
  // React Native has layout effects but no `document`; it identifies itself here.
  (typeof navigator !== "undefined" && navigator.product === "ReactNative")
    ? useLayoutEffect
    : useEffect;
