/**
 * The three corpus gates, run together: the burndown may not rise, parity
 * must stay identical, and naming the class slots must change nothing drawn. Local, not CI — the corpus is another repository's
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
 * - **Converted** is absolute, with a ratchet. `rushx convert-looks` rewrites every
 *   form to name its looks and writes a table per renderer; each converted form,
 *   drawn under html with the generated table, must be markup-identical to
 *   the original (look names aside), and the generated native table must
 *   load and evaluate. The count of class tokens it cannot express for
 *   native may only fall.
 * - **Looks** is absolute. Every form is drawn under html through the loader,
 *   which turns each control's class slots into a look and brings it with the
 *   form: anything printed to the console fails, as does a run in which no
 *   element names a look, since a check that never used one proves nothing.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

interface Baseline {
  burndown: { warnings: number };
  parity: { runs: number };
  looks: { runs: number };
  converted: { runs: number; unconverted: number };
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

interface LooksJson {
  runs: number;
  failing: number;
  named: number;
}

interface ConvertJson {
  forms: number;
  looks: number;
  unconverted: number;
  problems: number;
}
interface ConvertedJson {
  runs: number;
  different: number;
  printed: number;
  nativeParts: number;
  nativeProblems: number;
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
const looks = run<LooksJson>("looks-check");
const convert = run<ConvertJson>("convert-looks");
const converted = run<ConvertedJson>("converted-check");

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

// ── looks: absolute ───────────────────────────────────────────────────
if (looks.failing)
  failures.push(
    `looks: ${looks.failing} run(s) printed to the console drawing the loader's looks. \`rushx looks-check\` lists them.`,
  );
if (looks.named === 0)
  failures.push("looks: no element names a look — the check used none, so it proves nothing");
if (looks.runs !== baseline.looks.runs) {
  notes.push(
    `looks: ${looks.runs} runs, where the baseline has ${baseline.looks.runs}` +
      (update ? "; baseline updated." : "; `--update` to record it."),
  );
  if (update) baseline.looks.runs = looks.runs;
}

// ── converted: absolute, and a ratchet on what native cannot express ───
if (convert.problems) failures.push(`converted: ${convert.problems} naming problem(s). \`rushx convert-looks\` lists them.`);
if (converted.different)
  failures.push(
    `converted: ${converted.different} run(s) drew differently once their looks were named. \`rushx converted-check\` shows where.`,
  );
if (converted.printed) failures.push(`converted: ${converted.printed} console message(s) drawing converted forms.`);
if (converted.nativeProblems)
  failures.push(`converted: ${converted.nativeProblems} native look part(s) failed to evaluate.`);
if (convert.unconverted > baseline.converted.unconverted)
  failures.push(
    `converted: ${convert.unconverted} class tokens not expressible on native, up from ${baseline.converted.unconverted}. See corpus/converted/report.md.`,
  );
else if (convert.unconverted < baseline.converted.unconverted) {
  notes.push(
    `converted: ${convert.unconverted} unconvertible class tokens, down from ${baseline.converted.unconverted}` +
      (update ? " — ratchet lowered." : " — `rushx gates --update` to lower it."),
  );
  if (update) baseline.converted.unconverted = convert.unconverted;
}
if (converted.runs !== baseline.converted.runs) {
  notes.push(`converted: ${converted.runs} runs, where the baseline has ${baseline.converted.runs}` + (update ? "; baseline updated." : "; `--update` to record it."));
  if (update) baseline.converted.runs = converted.runs;
}

if (update) writeFileSync("gates.json", JSON.stringify(baseline, null, 2) + "\n");

const expected = Object.entries(parity.expected)
  .map(([why, n]) => `${n} ${why}`)
  .join("; ");
console.log(
  `burndown  ${burndown.forms} forms, ${burndown.warnings} warnings (ratchet ${baseline.burndown.warnings})\n` +
    `parity    ${parity.identical} of ${parity.runs} runs identical, ${parity.differences} differences` +
    (expected ? ` (classified: ${expected})` : "") +
    `\nlooks     ${looks.runs - looks.failing} of ${looks.runs} runs clean, ${looks.named} elements name a look` +
    `\nconverted ${converted.runs - converted.different} of ${converted.runs} runs identical once named (${convert.looks} looks; ${converted.nativeParts} native parts evaluate; ${convert.unconverted} tokens not expressible on native, ratchet ${baseline.converted.unconverted})`,
);
for (const n of notes) console.log(`  · ${n}`);
if (failures.length) {
  console.log("\nFAILED");
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("\ngates pass");
