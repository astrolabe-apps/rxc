#!/usr/bin/env node
// forms-scenarios <file-or-dir…> --target name=url [--target name=url] [--only text] [--report file.md]
//
// Runs every scenario in the files (`*.scenario.ts`, `*.scenario.js` under a directory) on
// the first target; with a second target, on both, comparing step by step (the first the
// oracle). Exits non-zero when a scenario fails on the first target. Node 24 runs `.ts`
// scenario files as they are.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { androidTarget } from "./android.js";
import { compareRuns, formatResult, runScenario, type ScenarioResult, type StepDifference } from "./run.js";
import type { Scenario } from "./scenario.js";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const out: string[] = [];
  for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) out.push(args.splice(i, 2)[1]!);
  return out;
};
const targets = opt("--target").map((t) => {
  const [name, url] = t.split(/=(.*)/s);
  if (!name || !url) throw new Error(`--target is name=url, not "${t}"`);
  return androidTarget({ name, url });
});
const only = opt("--only")[0];
const reportFile = opt("--report")[0];
if (!targets.length || !args.length) {
  console.error("forms-scenarios <file-or-dir…> --target name=url [--target name=url] [--only text] [--report file.md]");
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
let failed = 0;
let md = `# Form scenarios\n\n`;
try {
  for (const s of chosen) {
    const a = await runScenario(s, first!);
    console.log(formatResult(a));
    if (!a.ok) failed++;
    md += "```\n" + formatResult(a) + "\n";
    let b: ScenarioResult | undefined;
    let diffs: StepDifference[] = [];
    if (second) {
      b = await runScenario(s, second);
      console.log(formatResult(b));
      md += formatResult(b) + "\n";
      diffs = compareRuns(a, b);
    }
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
console.log(`${chosen.length - failed} of ${chosen.length} passed on ${first!.name}`);
process.exit(failed ? 1 : 0);
