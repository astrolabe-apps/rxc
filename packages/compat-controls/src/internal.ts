/**
 * Diagnostics that are reachable but deliberately not public API.
 *
 * Mirrors the `@rx-controls/core/internal` convention: importable, documented,
 * and explicitly outside the semver promise the package's main entry point
 * makes. Nothing here is part of the v4 surface this package replicates.
 *
 * The ambient trace lives here rather than on `.` because its whole
 * observable output is a debugging vocabulary — the collector tags, the
 * `anon` fallback's frame text, the compute-depth suffix — which is worth
 * being free to change. Behaviour is still pinned by
 * `test/ambientTrace.test.ts`, so it is safe to read in a debugging session.
 */

export { setAmbientTrace, type AmbientTrace } from "./ambient.js";
