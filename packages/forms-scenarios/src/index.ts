/**
 * Form scenarios: written once against what is on screen and in the data, and
 * run against any app that draws the form — an app on the legacy renderers,
 * or one on Forms v2 — so the same test is a regression test for the one and
 * an acceptance test for the other.
 *
 * - **Scenarios** — the steps a user takes and what they should see.
 * - **Targets** — the apps they run against, and the protocol an app implements.
 * - **Running** — one target, or two compared step by step.
 * - **Comparing** — two targets' screens of a step, laid out: gaps, text sizes, edges, colours.
 *
 * @packageDocumentation
 */
export * from "./scenario.js";
export * from "./target.js";
export * from "./android.js";
export * from "./run.js";
export * from "./visual.js";
