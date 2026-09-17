/**
 * Bridge 1 — ambient reads.
 *
 * Restores the legacy module-global change collector: the prototype patch's
 * getters report each `(control, changeBit)` read here, and whoever installed
 * the collector (a component tracker, `collectChanges`, `withAmbient`)
 * accumulates them. The global lives in this package only — the core engine
 * remains global-free.
 */

import { ControlChange, getControlPath } from "@rx-controls/core";
import { addEscapedReadHook } from "@rx-controls/core/internal";
import type { Control as CoreControl, ReadContext } from "@rx-controls/core";
import type { ChangeListenerFunc, Control } from "./types.js";

// Declared up here, before its first use: a bundler can only inline `IS_DEV`
// — and so drop every strict-mode message from a production build — if the
// binding is initialized before anything references it. Below its first use
// esbuild treats it as TDZ-unsafe and keeps the whole branch.
declare const process: { env: Record<string, string | undefined> } | undefined;

const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

/**
 * The currently installed ambient collector, or `undefined` outside any
 * tracking window. Exported as a live binding, matching legacy.
 */
export let collectChange: ChangeListenerFunc<any> | undefined;

/** Install (or clear) the ambient collector. Prefer {@link collectChanges}
 * — it save/restores, so nested windows compose. */
export function setChangeCollector(
  c: ChangeListenerFunc<any> | undefined,
): void {
  if (IS_DEV && c !== undefined) everCollected = true;
  collectChange = c;
}

/**
 * Run `run` with `listener` installed as the ambient collector, restoring
 * the previous collector afterwards. Every tracked getter read inside `run`
 * reports to `listener`.
 */
export function collectChanges<A>(
  listener: ChangeListenerFunc<any>,
  run: () => A,
): A {
  const prev = collectChange;
  if (IS_DEV) everCollected = true;
  collectChange = listener;
  try {
    return run();
  } finally {
    collectChange = prev;
  }
}

/** Manually report a dependency on `(c, change)` to the ambient collector. */
export function trackControlChange(
  c: Control<any>,
  change: ControlChange,
): void {
  const cb = collectChange;
  if (cb !== undefined) cb(c, change);
  else if (IS_DEV && strictAmbient) reportAmbientMiss(c, change);
}

// ── Ambient trace (opt-in diagnostic) ────────────────────────────────
//
// Answers "which collector was installed when this read was reported?" — the
// one question strict mode cannot answer, because a read collected by the
// *wrong* owner looks perfectly healthy: a collector is installed, its rc is
// live, and a subscription is created — just not on the computation that
// needed it.

export type AmbientTrace = (
  control: Control<any>,
  change: ControlChange,
  listener: string,
) => void;

let ambientTrace: AmbientTrace | undefined;
let listenerSeq = 0;

/** True while a trace is installed — the cheap check for the report sites. */
export let ambientTracing = false;

/** Name a collector so a trace can identify it. Returns `fn` unchanged. */
export function tagCollector<F extends ChangeListenerFunc<any>>(
  fn: F,
  kind: string,
): F {
  if (!IS_DEV) return fn;
  const f = fn as unknown as Record<string, unknown>;
  let tag = kind + "#" + ++listenerSeq;
  if (kind === "anon") {
    // Only for collectors installed from outside this package: name the
    // frame that installed it, so "anon" still says where to look.
    const frame = (new Error().stack ?? "")
      .split("\n")
      .slice(3, 4)
      .join("")
      .trim();
    if (frame) tag += " (" + frame + ")";
  }
  f.__ambientTag = tag;
  return fn;
}

/**
 * The installed collector's tag, for a trace message.
 *
 * A collector that reaches here untagged gets one assigned on the spot, with
 * the site that installed it captured once — so a third-party
 * `collectChanges`/`setChangeCollector` caller is still identifiable instead
 * of collapsing into an anonymous bucket.
 */
export function describeCollector(
  cb: ChangeListenerFunc<any> | undefined,
): string {
  if (cb === undefined) return "<none>";
  const f = cb as unknown as Record<string, unknown>;
  const existing = f.__ambientTag as string | undefined;
  if (existing !== undefined) return existing;
  tagCollector(cb, "anon");
  return (f.__ambientTag as string | undefined) ?? "<untagged>";
}

/**
 * Install a callback invoked on every ambient report with the installed
 * collector's tag. Dev-only, off by default, and the report sites skip it
 * entirely while unset.
 */
export function setAmbientTrace(fn: AmbientTrace | undefined): void {
  if (!IS_DEV) return;
  ambientTrace = fn;
  ambientTracing = fn !== undefined;
}

/**
 * How many `updateComputedValue` computations are on the stack right now, and
 * what the ambient collector was when the innermost one was entered.
 *
 * This is what distinguishes "the compute never ran" from "the compute ran but
 * something else was collecting": a read that arrives with `computeDepth > 0`
 * and a non-`rc` collector means the swap `withAmbient` performs did not hold
 * for the duration of the compute.
 */
export let computeDepth = 0;
let computeEntryCollector = "<none>";

/** Bracket a compute so {@link traceAmbient} can report its nesting. */
export function enterCompute(expected: string): void {
  if (!IS_DEV) return;
  computeDepth++;
  computeEntryCollector = expected;
}

export function exitCompute(): void {
  if (!IS_DEV) return;
  computeDepth--;
}

/** Report site hook — call only when {@link ambientTracing}. */
export function traceAmbient(
  c: Control<any>,
  change: ControlChange,
  cb: ChangeListenerFunc<any> | undefined,
): void {
  ambientTrace?.(
    c,
    change,
    describeCollector(cb) +
      " depth=" +
      computeDepth +
      (computeDepth > 0 ? " entered=" + computeEntryCollector : ""),
  );
}

/**
 * A collector that converts ambient reads into explicit `rc` reads.
 *
 * Each reported change bit is re-read through the given {@link ReadContext},
 * which registers exactly that facet as a dependency. This is what lets a
 * legacy no-arg closure (`() => c.value + d.value`) drive any rc-based
 * primitive: the getter returns the snapshot, and this collector makes the
 * rc subscribe to it.
 */
export function ambientToRc(rc: ReadContext): ChangeListenerFunc<any> {
  return tagCollector((control, change) => {
    if (IS_DEV && strictAmbient && !rc.isTracking)
      reportStaleBridge(control, change);
    const c = control as unknown as CoreControl<unknown>;
    // `bridging` suppresses the escaped-read hook below: these reads are
    // already being reported (above) with the control's identity attached,
    // which the hook — which only receives the rc — cannot manage.
    if (IS_DEV) bridging = true;
    try {
      if (change & ControlChange.Value) rc.getValue(c);
      if (change & ControlChange.InitialValue) rc.getInitialValue(c);
      if (change & ControlChange.Valid) rc.isValid(c);
      if (change & ControlChange.Touched) rc.isTouched(c);
      if (change & ControlChange.Disabled) rc.isDisabled(c);
      if (change & ControlChange.Dirty) rc.isDirty(c);
      if (change & ControlChange.Error) rc.getError(c);
      if (change & ControlChange.Structure)
        rc.getElements(c as CoreControl<unknown[]>);
    } finally {
      if (IS_DEV) bridging = false;
    }
  }, "rc");
}

/**
 * Run a legacy ambient-reading closure under an explicit {@link ReadContext}.
 *
 * The workhorse adapter for every closure-taking legacy API: reads made via
 * the patched getters inside `fn` are mirrored into `rc` (see
 * {@link ambientToRc}), so `rc`'s owner re-runs when they change.
 */
export function withAmbient<A>(rc: ReadContext, fn: () => A): A {
  return collectChanges(ambientToRc(rc), fn);
}

// ── Strict ambient diagnostics ───────────────────────────────────────
//
// An ambient read with no collector installed returns a correct current
// value and registers *nothing*, so the consumer goes stale forever with no
// warning. Most such reads are deliberate and correct — event handlers,
// refs, effects, validators and any plain code outside a render all read
// current values on purpose — which is why this is opt-in rather than a
// blanket throw. Turn it on while hunting a staleness bug and the read that
// registers nothing names itself.
//
// Cost when off: one module-scope boolean load on a path that is already the
// cold half of a branch, inside an `IS_DEV &&` that bundlers fold away in
// production. No allocation, and no stack capture unless it fires.

/**
 * How a read that registers no dependency is reported.
 *
 * - `"off"` (default) — exactly the behaviour of every release to date: the
 *   read succeeds silently.
 * - `"warn"` — one `console.warn` per call site, naming the control.
 * - `"throw"` — throws on the first occurrence, so the stack points straight
 *   at the offending read.
 */
export type AmbientStrictness = "off" | "warn" | "throw";

/**
 * Hot-path flag — `true` when {@link getStrictAmbient} is anything but
 * `"off"`. A live binding so the report sites can guard with a single
 * boolean load rather than a string comparison or a function call.
 *
 * Always `false` in a production build: {@link setStrictAmbient} refuses to
 * turn it on there, and the report sites are behind `IS_DEV` anyway.
 */
export let strictAmbient = false;

let strictness: AmbientStrictness = "off";

function envStrictness(): AmbientStrictness {
  // Two escape hatches so this can be switched on without editing code:
  // `globalThis.RTF_STRICT_AMBIENT` (works in a browser bundle, and can be
  // set from a devtools console before the app mounts) and the
  // `RTF_STRICT_AMBIENT` env var (node, vitest, a dev server).
  const g = (globalThis as Record<string, unknown>)["RTF_STRICT_AMBIENT"];
  const e =
    typeof process !== "undefined"
      ? process.env["RTF_STRICT_AMBIENT"]
      : undefined;
  return coerceStrictness(g ?? e);
}

function coerceStrictness(v: unknown): AmbientStrictness {
  if (v === true) return "throw";
  if (v === "throw" || v === "warn" || v === "off") return v;
  if (v === "1" || v === "true") return "throw";
  return "off";
}

/**
 * Turn strict ambient diagnostics on or off. `true` is shorthand for
 * `"throw"`, `false` for `"off"`.
 *
 * No-op in a production build — this is a debugging aid, and the report
 * sites that consult it are compiled out there.
 */
export function setStrictAmbient(mode: boolean | AmbientStrictness): void {
  if (!IS_DEV) return;
  strictness = typeof mode === "boolean" ? (mode ? "throw" : "off") : mode;
  strictAmbient = strictness !== "off";
  for (let i = 0; i < strictListeners.length; i++) strictListeners[i](strictness);
}

/** The current strictness. */
export function getStrictAmbient(): AmbientStrictness {
  return strictness;
}

const strictListeners: ((m: AmbientStrictness) => void)[] = [];

/**
 * Observe strictness changes. Used by `strictReact.ts` to keep
 * `@rx-controls/react`'s captured-`rc` diagnostic at the same severity; not
 * otherwise interesting.
 */
export function onStrictAmbientChange(
  cb: (mode: AmbientStrictness) => void,
): () => void {
  strictListeners.push(cb);
  return () => {
    const i = strictListeners.indexOf(cb);
    if (i >= 0) strictListeners.splice(i, 1);
  };
}

if (IS_DEV) setStrictAmbient(envStrictness());

/** Whether any collector has ever been installed in this process. Lets the
 * message distinguish "the tracking plugin / provider was never wired up"
 * from "this particular read escaped its window". */
let everCollected = false;

const CHANGE_NAMES: [ControlChange, string][] = [
  [ControlChange.Value, "value"],
  [ControlChange.InitialValue, "initialValue"],
  [ControlChange.Valid, "valid"],
  [ControlChange.Touched, "touched"],
  [ControlChange.Disabled, "disabled"],
  [ControlChange.Dirty, "dirty"],
  [ControlChange.Error, "error"],
  [ControlChange.Structure, "structure (fields/elements)"],
  [ControlChange.Validate, "validate"],
];

function changeNames(change: ControlChange): string {
  const names = CHANGE_NAMES.filter(([bit]) => change & bit).map(([, n]) => n);
  return names.length ? names.join(" | ") : `ControlChange(${change})`;
}

/** `#42 (path: address.street)` — best effort, only built on a report. */
function describeControl(c: Control<any>): string {
  const core = c as unknown as CoreControl<unknown>;
  let where = "";
  try {
    const path = getControlPath(core);
    if (path.length) where = ` (path: ${path.join(".")})`;
  } catch {
    // A detached or exotic control; the uniqueId alone still identifies it.
  }
  return `#${core.uniqueId}${where}`;
}

const reportedSites = new Set<string>();

/** This package's own report sites — never the interesting frame. */
const OWN_FRAMES = ["ambient", "patch", "trackedValue"];

function callSite(): string {
  const stack = new Error().stack?.split("\n").slice(1) ?? [];
  return (
    stack.find((l) => !OWN_FRAMES.some((f) => l.includes(f)))?.trim() ??
    "<unknown>"
  );
}

/**
 * Report, or throw. `key` dedupes the warning — one message per (call site,
 * control), so a stale list does not bury the console while two genuinely
 * different stale reads still both get named.
 *
 * Throwing is never deduped: it is meant to stop on the first occurrence.
 */
function raise(message: string, key: string): void {
  if (strictness === "throw") throw new Error(message);
  const site = callSite();
  if (reportedSites.has(key + site)) return;
  reportedSites.add(key + site);
  // eslint-disable-next-line no-console
  console.warn(`${message}\n    at ${site}`);
}

/**
 * Cold path: a tracked read was reported with no collector installed.
 *
 * Only ever called under `IS_DEV && strictAmbient`, so nothing here — the
 * stack capture, the path walk, the string building — costs anything when
 * strict mode is off.
 */
export function reportAmbientMiss(
  c: Control<any>,
  change: ControlChange,
): void {
  raise(
    `[@react-typed-forms/core] Ambient read of ${changeNames(change)} on ` +
      `control ${describeControl(c)} registered no dependency: no change ` +
      `collector is installed. The read returned a correct current value, ` +
      `but nothing will re-run when that control changes.\n` +
      (everCollected
        ? `    A collector has been installed elsewhere in this process, so ` +
          `this read escaped its tracking window — it ran outside the ` +
          `component body / collectChanges / withAmbient that was meant to ` +
          `capture it (a callback, an effect, or a closure invoked later).`
        : `    No collector has *ever* been installed in this process, which ` +
          `usually means the SWC/Babel tracking plugin is not configured, or ` +
          `the component is not wrapped by useComponentTracking.`) +
      `\n    If the read is deliberate (event handler, ref, effect), use ` +
      `control.current.* — it is documented as untracked and reports nothing.`,
    `miss:${(c as unknown as CoreControl<unknown>).uniqueId}:${change}`,
  );
}

/**
 * Cold path: an ambient read was bridged onto a {@link ReadContext} whose
 * tracking window has already closed.
 *
 * This is the damning variant of a missed read — a collector *is* installed,
 * so the read looks tracked, but the rc it forwards to has finalized and
 * drops it. Distinguishing the two is the whole reason `withAmbient` checks
 * `rc.isTracking` rather than leaving it to the no-collector case.
 */
export function reportStaleBridge(
  c: Control<any>,
  change: ControlChange,
): void {
  raise(
    `[@react-typed-forms/core] Ambient read of ${changeNames(change)} on ` +
      `control ${describeControl(c)} was bridged onto a ReadContext whose ` +
      `tracking window has already closed, so it registered no dependency ` +
      `and nothing will re-run when that control changes.\n` +
      `    The legacy closure ran after its owner's render pass finished — ` +
      `typically because withAmbient(rc, fn) was handed an rc captured from ` +
      `an enclosing useReactive() body, or the closure is invoked from an ` +
      `effect/callback rather than during render.`,
    `bridge:${(c as unknown as CoreControl<unknown>).uniqueId}:${change}`,
  );
}
/**
 * Cold path: a read was collected by a {@link SubscriptionTracker} that has
 * already been cleaned up.
 *
 * The third way a read can look tracked and not be. A collector *is*
 * installed, so neither {@link reportAmbientMiss} nor
 * {@link reportStaleBridge} fires — but the tracker behind it has released
 * its subscriptions and its listener is attached to nothing, so the
 * subscription this read creates will never wake anybody. The shape that
 * produces it: a scoped effect/computed whose cleanup scope ran, while
 * something still consults the value it produced.
 */
export function reportDeadTracker(
  c: Control<any>,
  change: ControlChange,
): void {
  raise(
    `[@react-typed-forms/core] Ambient read of ${changeNames(change)} on ` +
      `control ${describeControl(c)} was collected by a SubscriptionTracker ` +
      `that has already been cleaned up, so nothing will re-run when that ` +
      `control changes.\n` +
      `    The effect/computed that owns the collector was disposed (its ` +
      `cleanup scope ran) but is still being consulted — usually a scope torn ` +
      `down while the value it produced is still mounted, or a scope reused ` +
      `across a remount.`,
    `dead:${(c as unknown as CoreControl<unknown>).uniqueId}:${change}`,
  );
}

// ── Escaped rc reads inside a legacy tracking window ─────────────────
//
// The mirror of `@rx-controls/react`'s captured-`rc` guard, for the case it
// cannot see: a finalized rc read while a *legacy ambient* window is open.
// React's rule keys off its own `openRc`, which is null while a legacy
// tracked component renders, so those escapes go unreported there.
//
// Installed with `addEscapedReadHook`, not `setEscapedReadHook`: the React
// adapter owns the single slot, and clobbering it would disable the very
// diagnostic this is trying to extend.
//
// Strict-mode only. Outside it this would be a firehose — every event handler
// that reads a finalized rc during a legacy render is legitimate.
let bridging = false;

if (IS_DEV) {
  addEscapedReadHook(() => {
    if (!strictAmbient || bridging) return;
    if (collectChange === undefined) return;
    raise(
      `[@react-typed-forms/core] A ReadContext whose tracking window has ` +
        `already closed was read while a legacy ambient tracking window was ` +
        `open. The read returned a current value but registered no ` +
        `dependency, so the surrounding component will not re-render when ` +
        `that control changes — an enclosing component's \`rc\` has been ` +
        `captured by a callback instead of using the one it was handed.`,
      "escapedRc",
    );
  });
}
