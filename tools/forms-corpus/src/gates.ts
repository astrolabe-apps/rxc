/**
 * The two corpus gates, run together: the burndown may not rise and parity
 * must stay identical. Local, not CI — the corpus is another repository's
 * forms and schemas, which a public repository cannot carry — so run it
 * before a change to the loader, a translator or an implementation lands.
 *
 *   rushx gates            fail on a regression, report an improvement
 *   rushx gates --update   also lower the burndown ratchet to what it measured
 *
 * The baseline is `gates.json`, committed: counts only, never corpus content.
 *
 * - **Burndown** is a ratchet. More warnings than the baseline, or any crash,
 *   fails; fewer is reported, and `--update` writes the new, lower number so
 *   the gain cannot be given back unnoticed.
 * - **Parity** is absolute. Any difference outside the classified divergences
 *   fails, as does a crash, and so does anything the v2 side printed to the
 *   console while it rendered. The classified divergences' counts are
 *   reported beside it, since a change there is worth a look even though it
 *   does not fail the gate.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Baseline {
  burndown: { warnings: number };
  parity: { runs: number };
}
interface BurndownJson {
  forms: number;
  warnings: number;
  crashed: { path: string; error: string }[];
}
interface ParityJson {
  runs: number;
  identical: number;
  differences: number;
  expected: Record<string, number>;
  crashed: string[];
  console: { run: string; messages: string[] }[];
}

const update = process.argv.includes("--update");
if (!existsSync("corpus")) {
  console.log(
    "No corpus/ here. Extract one from a legacy app first:\n" +
      "  rushx extract-corpus <name> <src-dir>\n" +
      "(see src/extract-corpus.ts). The gates need it and cannot run without it.",
  );
  process.exit(2);
}

const run = <T>(script: string): T =>
  JSON.parse(
    execFileSync("node", [`lib/${script}.js`, "--json", "corpus"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  ) as T;

const baseline = JSON.parse(readFileSync("gates.json", "utf8")) as Baseline;
const burndown = run<BurndownJson>("burndown");
const parity = run<ParityJson>("parity");

const failures: string[] = [];
const notes: string[] = [];

// ── burndown: a ratchet ───────────────────────────────────────────────
if (burndown.crashed.length)
  failures.push(
    `burndown: ${burndown.crashed.length} form(s) crashed the loader — ${burndown.crashed.map((c) => c.path).join(", ")}`,
  );
if (burndown.warnings > baseline.burndown.warnings)
  failures.push(
    `burndown: ${burndown.warnings} warnings, up from ${baseline.burndown.warnings}. ` +
      "`rushx burndown` lists them by shape.",
  );
else if (burndown.warnings < baseline.burndown.warnings) {
  notes.push(
    `burndown: ${burndown.warnings} warnings, down from ${baseline.burndown.warnings}` +
      (update ? " — ratchet lowered." : " — `rushx gates --update` to lower the ratchet."),
  );
  if (update) baseline.burndown.warnings = burndown.warnings;
}

// ── parity: absolute ──────────────────────────────────────────────────
if (parity.differences)
  failures.push(
    `parity: ${parity.differences} difference(s) from legacy. \`rushx parity\` lists the runs, \`--show <form>\` the paths.`,
  );
if (parity.crashed.length)
  failures.push(`parity: crashed — ${parity.crashed.join(", ")}`);
for (const c of parity.console)
  failures.push(`parity: v2 printed to the console in ${c.run}: ${c.messages[0].slice(0, 160)}`);
if (parity.runs !== baseline.parity.runs) {
  notes.push(
    `parity: ${parity.runs} runs, where the baseline has ${baseline.parity.runs} — the corpus changed` +
      (update ? "; baseline updated." : "; `--update` to record it."),
  );
  if (update) baseline.parity.runs = parity.runs;
}

if (update) writeFileSync("gates.json", JSON.stringify(baseline, null, 2) + "\n");

const expected = Object.entries(parity.expected)
  .map(([why, n]) => `${n} ${why}`)
  .join("; ");
console.log(
  `burndown  ${burndown.forms} forms, ${burndown.warnings} warnings (ratchet ${baseline.burndown.warnings})\n` +
    `parity    ${parity.identical} of ${parity.runs} runs identical, ${parity.differences} differences` +
    (expected ? ` (classified: ${expected})` : ""),
);
for (const n of notes) console.log(`  · ${n}`);
if (failures.length) {
  console.log("\nFAILED");
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\ngates pass");
