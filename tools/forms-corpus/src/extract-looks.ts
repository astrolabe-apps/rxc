/**
 * The looks converter, for the offline step: combining the looks of many
 * legacy forms into one set, when translating them to JSX or a new JSON format.
 *
 * At run time the loader already derives each form's looks as it loads the
 * form (`legacyLook` in `@rx-controls/forms-json`; `TranslateResult.looks`),
 * and a name is content-addressed — the same classes are the same name in every
 * form — so there is nothing to coordinate. This reads every form it is pointed
 * at, derives the same looks, and writes:
 *
 *   corpus/looks/forms/<app>/<Form>.json   one form's looks
 *   corpus/looks/union.json                every form's looks, combined, with where each is used
 *   corpus/looks/report.md                 what was found, by frequency
 *
 * The classes are carried verbatim: no parsing, no rounding. What they mean on
 * another platform is that platform's theme's question.
 *
 * `corpus/looks/names.json`, a map from a derived name to the one you prefer,
 * is applied in `union.json` (as `renames`) and survives re-running.
 *
 *   rushx extract-looks [<dir-or-file>...]     default ./corpus
 *
 * Output stays under `corpus/`, which is gitignored: it is other repositories'
 * class strings and this repository is public.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type { ControlDefinition } from "@rx-controls/forms-schema";
import type { ClassLook } from "@rx-controls/forms-react";
import { legacyLook } from "@rx-controls/forms-json";
import { loadForm, walkFiles } from "./corpus.js";

const args = process.argv.slice(2);
let roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];
if (roots.length === 0) {
  console.error("usage: extract-looks [<dir-or-file>...]  (default: ./corpus)");
  process.exit(2);
}
const base = existsSync("corpus") ? "corpus" : ".";
const outDir = join(base, "looks");

interface Use {
  parts: ClassLook;
  uses: number;
  forms: Set<string>;
}
const union = new Map<string, Use>();
let controls = 0;
let styled = 0;
let formCount = 0;

function visit(defs: ControlDefinition[], into: Record<string, ClassLook>, form: string): void {
  for (const def of defs) {
    controls++;
    const labelled = def.type === "Data" || def.type === "Group";
    const d = def as unknown as Record<string, unknown>;
    const ro = (d.renderOptions ?? {}) as Record<string, unknown>;
    const derived = legacyLook(
      def.type,
      {
        styleClass: d.styleClass,
        textClass: d.textClass,
        layoutClass: d.layoutClass,
        labelClass: d.labelClass,
        labelTextClass: d.labelTextClass,
        entryWrapperClass: ro.entryWrapperClass,
        selectedClass: ro.selectedClass,
        notSelectedClass: ro.notSelectedClass,
      },
      labelled,
    );
    if (derived) {
      styled++;
      into[derived.name] ??= derived.parts;
      const u = union.get(derived.name) ?? { parts: derived.parts, uses: 0, forms: new Set<string>() };
      u.uses++;
      u.forms.add(form);
      union.set(derived.name, u);
    }
    visit(def.children ?? [], into, form);
  }
}

for (const root of roots)
  for (const path of walkFiles(root)) {
    if (path.includes(join("corpus", "looks"))) continue;
    const form = loadForm(path);
    if (!form) continue;
    formCount++;
    const rel = relative(base, path);
    const looks: Record<string, ClassLook> = {};
    visit(form.controls, looks, rel);
    const file = join(outDir, "forms", dirname(rel), basename(rel, ".json") + ".json");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ looks }, null, 2) + "\n");
  }

const overrides: Record<string, string> = existsSync(join(outDir, "names.json"))
  ? (JSON.parse(readFileSync(join(outDir, "names.json"), "utf8")) as Record<string, string>)
  : {};
const all = [...union.entries()].sort((a, b) => b[1].uses - a[1].uses || a[0].localeCompare(b[0]));
const looks: Record<string, ClassLook> = {};
const renames: Record<string, string> = {};
for (const [name, u] of all) {
  looks[name] = u.parts;
  if (overrides[name]) renames[name] = overrides[name];
}
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "union.json"),
  JSON.stringify(
    { looks, renames, uses: Object.fromEntries(all.map(([n, u]) => [n, { uses: u.uses, forms: [...u.forms] }])) },
    null,
    2,
  ) + "\n",
);

const uses = all.reduce((n, [, u]) => n + u.uses, 0);
const cover = (n: number) =>
  ((100 * all.slice(0, n).reduce((a, [, u]) => a + u.uses, 0)) / Math.max(uses, 1)).toFixed(1);
const lines = [
  "# Looks converter report",
  "",
  `${formCount} forms · ${controls} controls · ${styled} carry class slots`,
  `${all.length} distinct looks (the classes, whichever kind writes them)`,
  `coverage by the most-used 10 / 25 / 50 / 100 looks: ${[10, 25, 50, 100].map(cover).join("% / ")}%`,
  `used once: ${all.filter(([, u]) => u.uses === 1).length}`,
  "",
  "## By use",
  "",
  ...all.slice(0, 80).map(([name, u]) => {
    const p = Object.entries(u.parts)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : "@ " + v.replace}`)
      .join(" | ");
    return `- \`${name}\` ×${u.uses} · ${u.forms.size} forms · ${p}`;
  }),
];
writeFileSync(join(outDir, "report.md"), lines.join("\n") + "\n");
console.log(lines.slice(0, 6).join("\n"));
console.log(`\nwrote ${join(outDir, "union.json")}, report.md and forms/`);
