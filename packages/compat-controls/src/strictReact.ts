/**
 * Keeps `@rx-controls/react`'s captured-`rc` diagnostic at the same severity
 * as this package's strict ambient mode.
 *
 * The two guards cover complementary halves of the same failure — a read that
 * returns a correct value and subscribes to nothing — so it would be
 * surprising for `setStrictAmbient("throw")` to leave the React half merely
 * warning. Kept in its own module so `ambient.ts` (which `patch.ts` pulls in
 * on the pure-core path) never drags React in.
 */

import { setWrongRcSeverity } from "@rx-controls/react";
import {
  getStrictAmbient,
  onStrictAmbientChange,
  type AmbientStrictness,
} from "./ambient.js";

declare const process: { env: { NODE_ENV?: string } } | undefined;
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

function apply(mode: AmbientStrictness): void {
  setWrongRcSeverity(mode === "throw" ? "throw" : "warn");
}

if (IS_DEV) {
  onStrictAmbientChange(apply);
  apply(getStrictAmbient());
}
