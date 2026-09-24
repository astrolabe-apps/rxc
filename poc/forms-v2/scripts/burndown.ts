/**
 * The corpus burndown.
 *
 * Runs the loader over every form definition it is pointed at and reports
 * what could not be carried across, by kind and by shape. Goal 6 says JSON
 * renders with identical semantics to legacy; open decision 2 made that
 * checkable — the acceptance test for the loader is this script printing
 * nothing. Until then, its output is the work list.
 *
 *   rushx burndown <dir-or-file>...            summary table
 *   rushx burndown --json <dir-or-file>...     machine-readable
 *   rushx burndown --strict <dir-or-file>...   exit 1 if any warning
 *   rushx burndown --show <kind:shape> ...      list every warning of one shape
 *
 * A form file is either `{ controls, fields }` (what the form editor writes)
 * or a bare `ControlDefinition[]` with no schema.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createControlContext } from "@rx-controls/core";
import { translateForm, type LoaderWarning } from "../src/loader/translate.js";
import type { ControlDefinition, SchemaField } from "../src/loader/json.js";

interface FormFile {
  path: string;
  controls: ControlDefinition[];
  fields: SchemaField[];
}

interface FormResult {
  path: string;
  controls: number;
  warnings: LoaderWarning[];
  crashed?: string;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const strict = args.includes("--strict");
const showAt = args.indexOf("--show");
const show = showAt >= 0 ? args[showAt + 1] : undefined;
let roots = args.filter(
  (a, i) => !a.startsWith("--") && !(showAt >= 0 && i === showAt + 1),
);
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];
if (roots.length === 0) {
  console.error(
    "usage: burndown [--json] [--strict] [--show kind:shape] <dir-or-file>...  (default: ./corpus)",
  );
  process.exit(2);
}

function* walk(p: string): Generator<string> {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      yield* walk(join(p, e));
    }
  } else if (p.endsWith(".json")) yield p;
}

function load(path: string): FormFile | undefined {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (Array.isArray(raw))
    return { path, controls: raw as ControlDefinition[], fields: [] };
  if (raw && typeof raw === "object" && Array.isArray((raw as any).controls))
    return {
      path,
      controls: (raw as any).controls as ControlDefinition[],
      fields: ((raw as any).fields ?? []) as SchemaField[],
    };
  return undefined; // not a form
}

function countControls(defs: ControlDefinition[]): number {
  return defs.reduce((n, d) => n + 1 + countControls(d.children ?? []), 0);
}

function run(form: FormFile): FormResult {
  const ctx = createControlContext();
  const data = ctx.newControl<unknown>({});
  try {
    const { warnings } = translateForm(
      ctx,
      data,
      form.fields,
      form.controls,
      {},
    );
    return {
      path: form.path,
      controls: countControls(form.controls),
      warnings,
    };
  } catch (e) {
    return {
      path: form.path,
      controls: countControls(form.controls),
      warnings: [],
      crashed: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * `renderOptions "Radio" is not understood…` → `Radio`; otherwise the detail
 * itself. A schema miss is bucketed by the *syntax* of the reference — a plain
 * name is a schema the input did not supply, `../x` and `a/b` are reference
 * forms the loader does not resolve yet — because that is the split that
 * separates loader work from corpus-input work.
 */
function shape(w: LoaderWarning): string {
  if (w.kind === "schema") {
    const f = w.subject ?? "";
    if (f.startsWith("..")) return "parent ref (../x)";
    if (f === ".") return "self ref (.)";
    if (f.includes("/")) return "path ref (a/b)";
    return "plain name — schema not supplied";
  }
  const m = /"([^"]+)"/.exec(w.detail);
  return m ? m[1] : w.detail;
}

const results: FormResult[] = [];
for (const root of roots)
  for (const p of walk(root)) {
    const f = load(p);
    if (f) results.push(run(f));
  }

const all = results.flatMap((r) => r.warnings);
const byKind = new Map<string, number>();
const byShape = new Map<
  string,
  { kind: string; count: number; forms: Set<string> }
>();
for (const r of results)
  for (const w of r.warnings) {
    byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
    const k = `${w.kind}:${shape(w)}`;
    const e = byShape.get(k) ?? {
      kind: w.kind,
      count: 0,
      forms: new Set<string>(),
    };
    e.count++;
    e.forms.add(r.path);
    byShape.set(k, e);
  }
const clean = results.filter((r) => r.warnings.length === 0 && !r.crashed);
const crashed = results.filter((r) => r.crashed);

if (show) {
  // Trace one shape back to the controls that produce it.
  const cwd = process.cwd();
  let n = 0;
  for (const r of results)
    for (const w of r.warnings)
      if (`${w.kind}:${shape(w)}` === show) {
        n++;
        console.log(
          `${relative(cwd, r.path)} @${w.path}  ${w.subject ?? "-"}\n    ${w.detail}`,
        );
      }
  console.log(`\n${n} warning(s) of shape ${show}`);
} else if (json) {
  console.log(
    JSON.stringify(
      {
        forms: results.length,
        clean: clean.length,
        crashed: crashed.map((r) => ({ path: r.path, error: r.crashed })),
        warnings: all.length,
        byKind: Object.fromEntries(byKind),
        byShape: [...byShape.entries()]
          .map(([key, e]) => ({
            key,
            kind: e.kind,
            count: e.count,
            forms: e.forms.size,
          }))
          .sort((a, b) => b.count - a.count),
        perForm: results
          .map((r) => ({
            path: r.path,
            controls: r.controls,
            warnings: r.warnings.length,
          }))
          .sort((a, b) => b.warnings - a.warnings),
      },
      null,
      2,
    ),
  );
} else {
  const cwd = process.cwd();
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(
    `${results.length} forms, ${results.reduce((n, r) => n + r.controls, 0)} controls — ` +
      `${clean.length} clean, ${all.length} warnings` +
      (crashed.length ? `, ${crashed.length} crashed` : ""),
  );
  console.log("\nby kind");
  for (const [k, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${pad(k, 14)} ${n}`);
  console.log("\nby shape (count · forms)");
  for (const [key, e] of [...byShape.entries()].sort(
    (a, b) => b[1].count - a[1].count,
  ))
    console.log(`  ${pad(e.count, 5)} ${pad(e.forms.size, 4)} ${key}`);
  console.log("\nworst forms");
  for (const r of [...results]
    .sort((a, b) => b.warnings.length - a.warnings.length)
    .slice(0, 15))
    console.log(
      `  ${pad(r.warnings.length, 5)} ${pad(r.controls, 5)} ${relative(cwd, r.path)}`,
    );
  if (crashed.length) {
    console.log("\ncrashed");
    for (const r of crashed)
      console.log(`  ${relative(cwd, r.path)}: ${r.crashed}`);
  }
}

if (strict && (all.length > 0 || crashed.length > 0)) process.exit(1);
