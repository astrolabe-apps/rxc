import { dataAt, describeStep, type Scenario, type Step } from "./scenario.js";
import {
  findField,
  findOption,
  findText,
  findToggle,
  findTrigger,
  isGlyph,
  isInput,
  label,
  type ScreenNode,
  type Target,
} from "./target.js";

/**
 * What one step did: whether it held, why not, and what was on screen and in
 * the data afterwards — the snapshot a differential run compares.
 *
 * @group Running
 */
export interface StepResult {
  /** The step. */
  step: Step;
  /** `false` for a step that failed; `undefined` for one never reached. */
  ok?: boolean;
  /** Why it failed. */
  message?: string;
  /** The words on screen afterwards, in reading order (icon glyphs left out). */
  texts?: string[];
  /** The form's data afterwards. */
  data?: unknown;
}

/**
 * A scenario's run on one target.
 *
 * @group Running
 */
export interface ScenarioResult {
  /** The scenario run. */
  scenario: Scenario;
  /** The target it ran on. */
  target: string;
  /** Every step held. */
  ok: boolean;
  /** Each step's result, in order. */
  steps: StepResult[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The words on screen, as a person reads them: no icon glyphs, a merged element once. */
export function screenTexts(nodes: ScreenNode[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of nodes) {
    // An icon font's glyph is not words, alone or inside a merged name ("\uF05A, Why?").
    const l = label(n).replace(/[\uE000-\uF8FF]/g, "").replace(/^[\s,]+/, "").trim();
    if (!l || isGlyph(l) || n.w <= 0 || n.h <= 0) continue;
    const k = `${l}|${n.x}|${n.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

const json = (v: unknown) => JSON.stringify(v ?? null);

/**
 * Find something on screen; on a target that scrolls, scroll the form to find it — toward
 * its end, then back toward its start — stopping where the screen no longer changes.
 * Returns the screen it was found on.
 */
async function locate<T>(
  t: Target,
  find: (nodes: ScreenNode[]) => T | undefined,
): Promise<{ found: T | undefined; nodes: ScreenNode[] }> {
  let nodes = await t.screen();
  let found = find(nodes);
  if (found !== undefined || !t.scroll) return { found, nodes };
  const key = (ns: ScreenNode[]) => ns.map((n) => `${label(n)}@${n.y}`).join("|");
  for (const direction of ["down", "up"] as const) {
    for (let i = 0; i < 12; i++) {
      const before = key(nodes);
      await t.scroll(direction);
      nodes = await t.screen();
      found = find(nodes);
      if (found !== undefined) return { found, nodes };
      if (key(nodes) === before) break;
    }
  }
  return { found, nodes };
}

/** Do one step; throw with a reason when it cannot be done or does not hold. */
async function perform(t: Target, s: Step): Promise<void> {
  const nodes = await t.screen();
  switch (s.kind) {
    case "press": {
      const n = (await locate(t, (ns) => findText(ns, s.name))).found;
      if (!n) throw new Error(`nothing named "${s.name}" on screen`);
      if (!n.enabled) throw new Error(`"${s.name}" is disabled`);
      return t.tap(n);
    }
    case "fill": {
      const { found: n, nodes: at } = await locate(t, (ns) => findField(ns, s.label));
      if (!n) throw new Error(`no field labelled "${s.label}"`);
      await t.tap(n);
      await t.type(s.text, n.text);
      // Then leave the field, as a person does, by tapping its label. With the keyboard up,
      // React Native takes the next tap outside the field as dismissing it and nothing else
      // sees that tap — so the step after this one would be lost (a radio not chosen, a Save
      // not pressed). A label is words that do nothing, on every target.
      const l = findText(at, s.label);
      if (l && l !== n && !isInput(l)) await t.tap(l);
      return;
    }
    case "toggle": {
      const n = (await locate(t, (ns) => findToggle(ns, s.label))).found;
      if (!n) throw new Error(`no checkbox or switch labelled "${s.label}"`);
      return t.tap(n);
    }
    case "choose": {
      // The question in view first; then its option, or what opens its options.
      const { nodes: at } = await locate(t, (ns) => findText(ns, s.label));
      const o = (await locate(t, (ns) => findOption(ns, s.label, s.option))).found;
      if (o) return t.tap(o);
      const trigger = findTrigger(at, s.label);
      if (!trigger) throw new Error(`no "${s.option}" for "${s.label}", and nothing to open`);
      await t.tap(trigger);
      const opened = findText(await t.screen(), s.option);
      if (!opened) throw new Error(`"${s.label}" opened, but offers no "${s.option}"`);
      return t.tap(opened);
    }
    case "expectVisible":
      if (!(await locate(t, (ns) => findText(ns, s.text))).found)
        throw new Error(`"${s.text}" is not on screen`);
      return;
    case "expectHidden":
      if (findText(nodes, s.text)) throw new Error(`"${s.text}" is on screen`);
      return;
    case "expectData": {
      const got = dataAt((await t.report()).data, s.path);
      if (json(got) !== json(s.value))
        throw new Error(`${s.path} is ${json(got)}, not ${json(s.value)}`);
      return;
    }
    case "expectAction": {
      const { actions } = await t.report();
      if (!actions.some((a) => a.actionId === s.actionId))
        throw new Error(
          `"${s.actionId}" was not called (called: ${actions.map((a) => a.actionId).join(", ") || "nothing"})`,
        );
      return;
    }
  }
}

/**
 * How a run reports and paces itself — for watching one happen.
 *
 * @group Running
 */
export interface RunOptions {
  /**
   * Told as each step starts (`ok` undefined) and as it ends (`ok` set, with
   * its `message` when it failed).
   */
  onStep?: (step: StepResult, index: number) => void;
  /** Wait this long after each step, in ms, so a person can follow. Default 0. */
  pause?: number;
}

/**
 * Run a scenario on a target: open the form with its data, then each step in
 * order, stopping at the first that fails. Every step's snapshot is kept.
 *
 * @group Running
 */
export async function runScenario(
  scenario: Scenario,
  target: Target,
  options: RunOptions = {},
): Promise<ScenarioResult> {
  const steps: StepResult[] = scenario.steps.map((step) => ({ step }));
  await target.open(scenario.form, scenario.data ?? {});
  let ok = true;
  for (const [i, r] of steps.entries()) {
    options.onStep?.(r, i);
    try {
      await perform(target, r.step);
      r.ok = true;
    } catch (e) {
      r.ok = false;
      r.message = e instanceof Error ? e.message : String(e);
      ok = false;
    }
    r.texts = screenTexts(await target.screen());
    r.data = (await target.report()).data;
    options.onStep?.(r, i);
    if (options.pause) await sleep(options.pause);
    if (!ok) break;
  }
  return { scenario, target: target.name, ok, steps };
}

/**
 * Where two runs of one scenario part: per step, whether it held on each, the
 * words on screen on one and not the other, and data paths that differ.
 *
 * @group Running
 */
export interface StepDifference {
  /** The step, as a sentence. */
  step: string;
  /** Held on the first target, the second. */
  ok: [boolean | undefined, boolean | undefined];
  /** Words on screen only on the first target (as a multiset). */
  onlyFirst: string[];
  /** Words on screen only on the second target. */
  onlySecond: string[];
  /** Data paths whose values differ, with the two values. */
  data: {
    /** Where. */
    path: string;
    /** The first target's value. */
    first: unknown;
    /** The second target's value. */
    second: unknown;
  }[];
}

/**
 * Both runs of a scenario and where they part.
 *
 * @group Running
 */
export interface DifferentialResult {
  /** The run on the first target, the oracle. */
  first: ScenarioResult;
  /** The run on the second target. */
  second: ScenarioResult;
  /** Where they part, step by step. */
  differences: StepDifference[];
}

/** The leaf paths of a value. */
function leaves(v: unknown, path = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (v !== null && typeof v === "object") {
    const entries = Object.entries(v as object);
    if (!entries.length) out[path] = Array.isArray(v) ? [] : {};
    for (const [k, x] of entries) leaves(x, path ? `${path}/${k}` : k, out);
  } else out[path] = v;
  return out;
}

/** What `a` has that `b` lacks, counting repeats. */
function minus(a: string[], b: string[]): string[] {
  const left = [...b];
  return a.filter((x) => {
    const i = left.indexOf(x);
    if (i < 0) return true;
    left.splice(i, 1);
    return false;
  });
}

/**
 * Compare two runs of one scenario step by step — a differential test, the
 * first target the oracle. Only steps where something differs are returned.
 *
 * @group Running
 */
export function compareRuns(first: ScenarioResult, second: ScenarioResult): StepDifference[] {
  const out: StepDifference[] = [];
  first.steps.forEach((a, i) => {
    const b = second.steps[i]!;
    const la = leaves(a.data ?? {}), lb = leaves(b.data ?? {});
    const data = [...new Set([...Object.keys(la), ...Object.keys(lb)])]
      .filter((p) => json(la[p]) !== json(lb[p]))
      .map((path) => ({ path, first: la[path], second: lb[path] }));
    const onlyFirst = minus(a.texts ?? [], b.texts ?? []);
    const onlySecond = minus(b.texts ?? [], a.texts ?? []);
    if (a.ok !== b.ok || onlyFirst.length || onlySecond.length || data.length)
      out.push({ step: describeStep(a.step), ok: [a.ok, b.ok], onlyFirst, onlySecond, data });
  });
  return out;
}

/**
 * Run a scenario on two targets, the first the oracle, and compare.
 *
 * @group Running
 */
export async function runDifferential(
  scenario: Scenario,
  first: Target,
  second: Target,
): Promise<DifferentialResult> {
  const a = await runScenario(scenario, first);
  await sleep(0);
  const b = await runScenario(scenario, second);
  return { first: a, second: b, differences: compareRuns(a, b) };
}

/**
 * A run as text: each step, ✓ or ✗ and why.
 *
 * @group Running
 */
export function formatResult(r: ScenarioResult): string {
  return [
    `${r.ok ? "✓" : "✗"} ${r.scenario.name} — ${r.target}`,
    ...r.steps.map(
      (s) =>
        `  ${s.ok === undefined ? "·" : s.ok ? "✓" : "✗"} ${describeStep(s.step)}${s.message ? ` — ${s.message}` : ""}`,
    ),
  ].join("\n");
}
