#!/usr/bin/env node
// forms-scenarios <file-or-dir…> --target name=url [--target name=url] [--only text] [--report file.md]
//                 [--watch] [--slow ms] [--no-tall] [--timings] [--shots dir]
//
// Each step is printed as it happens. To watch a run on the device: --watch (a pause of 1.5s
// between steps), or --slow <ms> for another pause; --no-tall keeps the screen its own size
// (a form longer than the screen is scrolled to find what each step needs). --timings prints
// where a run's time went: each kind of call to the device, its count and total. --shots
// <dir> keeps a picture of the screen as each form opens and after each step, per target,
// and writes <dir>/index.html with the targets' pictures side by side, step by step; with two
// targets it also compares each step's layouts (gaps, text sizes and edges, colours) and writes
// <dir>/layout.md, the steps that differ most first, and marks them in index.html.
//
// forms-scenarios install-server — install the screen server on the device (Appium's
// UiAutomator2 server: a screen read in a fraction of a second rather than two seconds).
//
// Runs every scenario in the files (`*.scenario.ts`, `*.scenario.js` under a directory) on
// the first target; with a second target, on both, comparing step by step (the first the
// oracle). Exits non-zero when a scenario fails on the first target. Node 24 runs `.ts`
// scenario files as they are.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { androidTarget, defaultAdb } from "./android.js";
import { installScreenServer, SCREEN_SERVER_PACKAGE } from "./screenServer.js";
import {
  compareRuns,
  formatResult,
  runScenario,
  type RunOptions,
  type ScenarioResult,
  type StepDifference,
} from "./run.js";
import { describeStep, type Scenario } from "./scenario.js";
import { scoreShots, writeLayoutReport, type LayoutStep, type ShotsManifest } from "./layoutReport.js";
import type { Target } from "./target.js";

const args = process.argv.slice(2);
if (args[0] === "layout") {
  // forms-scenarios layout <shots-dir>: compare a --shots run's layouts again, no device.
  const dir = args[1];
  if (!dir) {
    console.error("forms-scenarios layout <shots-dir>");
    process.exit(2);
  }
  const steps = scoreShots(dir);
  const file = writeLayoutReport(dir, steps);
  console.log(`layout: ${steps.length} step(s) differ — ${file}`);
  for (const l of steps.slice(0, 10)) console.log(`  ${String(l.score).padStart(5)}  ${l.scenario} — ${l.what}`);
  process.exit(0);
}
if (args[0] === "install-server") {
  console.log(`installing ${SCREEN_SERVER_PACKAGE} on the device`);
  installScreenServer(defaultAdb());
  process.exit(0);
}
const opt = (name: string) => {
  const out: string[] = [];
  for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) out.push(args.splice(i, 2)[1]!);
  return out;
};
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const watch = flag("--watch");
const timings = flag("--timings");
const tall = !flag("--no-tall");
const slow = opt("--slow")[0];
const pause = slow !== undefined ? Number(slow) : watch ? 1500 : 0;
const targets = opt("--target").map((t) => {
  const [name, url] = t.split(/=(.*)/s);
  if (!name || !url) throw new Error(`--target is name=url, not "${t}"`);
  return timed(androidTarget({ name, url, tallHeight: tall ? undefined : 0 }));
});
/** Time spent per kind of call, per target: `legacy screen` → calls and ms. */
const spent = new Map<string, { calls: number; ms: number }>();
function timed(t: Target): Target {
  const wrap =
    <A extends unknown[], R>(what: string, f: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const start = performance.now();
      try {
        return await f(...a);
      } finally {
        const k = `${t.name} ${what}`;
        const e = spent.get(k) ?? { calls: 0, ms: 0 };
        e.calls++;
        e.ms += performance.now() - start;
        spent.set(k, e);
      }
    };
  return {
    ...t,
    open: wrap("open", t.open),
    screen: wrap("screen", t.screen),
    tap: wrap("tap", t.tap),
    type: wrap("type", t.type),
    report: wrap("report", t.report),
    scroll: t.scroll && wrap("scroll", t.scroll),
  };
}
const only = opt("--only")[0];
const reportFile = opt("--report")[0];
const shotsDir = opt("--shots")[0];
if (!targets.length || !args.length) {
  console.error(
    "forms-scenarios <file-or-dir…> --target name=url [--target name=url] [--only text] [--report file.md] [--watch] [--slow ms] [--no-tall] [--timings] [--shots dir]\nforms-scenarios install-server",
  );
  process.exit(2);
}

function walk(p: string): string[] {
  const full = resolve(p);
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap((f) => walk(join(full, f)));
  return /\.scenarios?\.(ts|js|mjs)$/.test(full) ? [full] : [];
}
const files = args.flatMap((a) => walk(a));
const scenarios: Scenario[] = [];
for (const f of files.sort()) {
  const mod = (await import(pathToFileURL(f).href)) as Record<string, unknown>;
  for (const v of Object.values(mod)) {
    const list = Array.isArray(v) ? v : [v];
    for (const s of list)
      if (s && typeof s === "object" && "form" in s && "steps" in s) scenarios.push(s as Scenario);
  }
}
const chosen = only ? scenarios.filter((s) => s.name.includes(only) || s.form === only) : scenarios;
console.log(`${chosen.length} scenario(s) from ${files.length} file(s), on ${targets.map((t) => t.name).join(" and ")}\n`);

const [first, second] = targets;


/** Steps whose layouts differ, keyed `folder|step`, once the run is scored. */
let layouts = new Map<string, LayoutStep>();

/** The pictures of each scenario, per step (0 the form as it opened), per target: file names under `shotsDir`. */
const shots: { scenario: Scenario; steps: Map<number, Map<string, string>> }[] = [];

/** Each step as it happens: on a terminal, "▸ step" replaced by its ✓ or ✗ when it ends. */
const live = process.stdout.isTTY;
const run = async (s: Scenario, t: (typeof targets)[number]) => {
  let pictures = shots.find((x) => x.scenario === s);
  if (shotsDir && !pictures) shots.push((pictures = { scenario: s, steps: new Map() }));
  const folder = String(shots.length).padStart(2, "0");
  console.log(`\u25B6 ${s.name} \u2014 ${t.name}`);
  const options: RunOptions = {
    pause,
    onShot: shotsDir
      ? (i, png) => {
          const file = `${folder}/${i + 1}-${t.name}.png`;
          mkdirSync(join(shotsDir, folder), { recursive: true });
          writeFileSync(join(shotsDir, file), png);
          const at = pictures!.steps.get(i + 1) ?? new Map<string, string>();
          at.set(t.name, file);
          pictures!.steps.set(i + 1, at);
        }
      : undefined,
    onStep: (r) => {
      const what = describeStep(r.step);
      if (r.ok === undefined) {
        if (live) process.stdout.write(`  \u25B8 ${what}`);
        return;
      }
      const line = `  ${r.ok ? "\u2713" : "\u2717"} ${what}${r.message ? ` \u2014 ${r.message}` : ""}`;
      process.stdout.write(live ? `\r\x1b[K${line}\n` : `${line}\n`);
    },
  };
  const start = performance.now();
  const r = await runScenario(s, t, options);
  const secs = `${((performance.now() - start) / 1000).toFixed(1)}s`;
  const skipped = r.steps.filter((x) => x.ok === undefined).length;
  console.log(
    `${r.ok ? "\u2713 passed" : `\u2717 failed${skipped ? ` (${skipped} step(s) not reached)` : ""}`} in ${secs}\n`,
  );
  return r;
};
let failed = 0;
const began = performance.now();
let md = `# Form scenarios\n\n`;
try {
  for (const s of chosen) {
    const a = await run(s, first!);
    if (!a.ok) failed++;
    md += "```\n" + formatResult(a) + "\n";
    let b: ScenarioResult | undefined;
    let diffs: StepDifference[] = [];
    if (second) {
      b = await run(s, second);
      md += formatResult(b) + "\n";
      diffs = compareRuns(a, b);
    }
    if (shotsDir) saveScreens(s, [a, b].filter((r): r is ScenarioResult => !!r));
    md += "```\n\n";
    // A difference is shown at the step it first appears, not again while it lasts.
    let shown = new Set<string>();
    for (const d of diffs) {
      const now = [
        ...d.onlyFirst.map((t) => `only ${first!.name}: "${t}"`),
        ...d.onlySecond.map((t) => `only ${second!.name}: "${t}"`),
        ...d.data.map((x) => `data ${x.path}: ${JSON.stringify(x.first)} vs ${JSON.stringify(x.second)}`),
      ];
      const fresh = now.filter((l) => !shown.has(l));
      const held = d.ok[0] !== d.ok[1] ? ` (held: ${first!.name} ${d.ok[0]}, ${second!.name} ${d.ok[1]})` : "";
      shown = new Set(now);
      if (!fresh.length && !held) continue;
      const lines = [`  \u2260 ${d.step}${held}`, ...fresh.map((l) => `      ${l}`)];
      console.log(lines.join("\n"));
      md += lines.map((l) => `    ${l}`).join("\n") + "\n\n";
    }
    console.log();
  }
} finally {
  for (const t of targets) await t.close();
}
if (reportFile) writeFileSync(reportFile, md);
if (shotsDir) {
  const manifest: ShotsManifest = {
    targets: targets.map((t) => t.name),
    scenarios: shots.map(({ scenario }, i) => ({
      name: scenario.name,
      folder: String(i + 1).padStart(2, "0"),
      steps: scenario.steps.map(describeStep),
    })),
  };
  writeFileSync(join(shotsDir, "shots.json"), JSON.stringify(manifest, null, 1));
  if (second) {
    const steps = scoreShots(shotsDir);
    layouts = new Map(steps.map((l) => [`${l.folder}|${l.step}`, l]));
    const file = writeLayoutReport(shotsDir, steps);
    console.log(`\nlayout: ${steps.length} step(s) differ — ${file}`);
    for (const l of steps.slice(0, 5)) console.log(`  ${String(l.score).padStart(5)}  ${l.scenario} — ${l.what}`);
  }
  writeFileSync(join(shotsDir, "index.html"), shotsPage());
}


/** Each run's screen reads beside its pictures, for the layout comparison (`<step>-<target>.screen.json`). */
function saveScreens(s: Scenario, runs: ScenarioResult[]) {
  const folder = String(shots.findIndex((x) => x.scenario === s) + 1).padStart(2, "0");
  for (const r of runs)
    [r.opened, ...r.steps.map((x) => x.screen)].forEach((screen, i) => {
      if (screen) writeFileSync(join(shotsDir!, folder, `${i}-${r.target}.screen.json`), JSON.stringify(screen));
    });
}


/** The targets' pictures side by side, a row per step, a section per scenario. */
function shotsPage(): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const names = targets.map((t) => t.name);
  const sections = shots.map(({ scenario, steps }, si) => {
    const rows = [...steps.entries()].map(([i, files]) => {
      const layout = layouts.get(`${String(si + 1).padStart(2, "0")}|${i}`);
      const flag = layout
        ? ` <span class="flag" title="${esc(layout.differences.map((d) => `${d.kind} ${d.words.slice(0, 40)}: ${d.first} vs ${d.second}`).join("\n"))}">layout ${layout.score}</span>`
        : "";
      const what = (i === 0 ? "opened" : `${i}. ${describeStep(scenario.steps[i - 1]!)}`) + flag;
      const cells = names
        .map((n) => {
          const f = files.get(n);
          return `<figure><figcaption>${esc(n)}</figcaption>${f ? `<a href="${esc(f)}"><img loading="lazy" src="${esc(f)}"></a>` : "<p>—</p>"}</figure>`;
        })
        .join("");
      return `<h3>${what.includes('class="flag"') ? what.replace(/^([^<]*)/, (m) => esc(m)) : esc(what)}</h3><div class="pair">${cells}</div>`;
    });
    return `<section><h2>${esc(scenario.name)}</h2>${rows.join("")}</section>`;
  });
  return `<!doctype html><meta charset="utf-8"><title>Form scenarios, side by side</title>
<style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}.pair{display:flex;gap:16px;align-items:flex-start}
figure{margin:0;flex:1;max-width:420px}figcaption{font-weight:600;margin-bottom:4px}img{width:100%;border:1px solid #ccc}
h2{margin-top:40px;border-top:2px solid #333;padding-top:8px}h3{font-weight:500;margin:20px 0 6px}
.flag{background:#b45309;color:#fff;border-radius:4px;padding:1px 6px;font-size:12px;cursor:help}</style>
<h1>Form scenarios, side by side</h1>${sections.join("")}`;
}
console.log(
  `${chosen.length - failed} of ${chosen.length} passed on ${first!.name} in ${((performance.now() - began) / 1000).toFixed(1)}s`,
);
if (timings) {
  console.log("\nwhere the time went:");
  for (const [k, e] of [...spent].sort((a, b) => b[1].ms - a[1].ms))
    console.log(
      `  ${k.padEnd(18)} ${String(e.calls).padStart(5)} calls  ${(e.ms / 1000).toFixed(1).padStart(7)}s  ${(e.ms / e.calls).toFixed(0).padStart(6)}ms each`,
    );
}
process.exit(failed ? 1 : 0);
