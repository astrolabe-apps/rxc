/**
 * The looks converter: legacy forms in, forms that name their looks out.
 *
 * A legacy control carries its styling as class strings (`styleClass`,
 * `textClass`, …). This reads every form it is pointed at and writes:
 *
 *   corpus/converted/forms/<app>/<Form>.json   each form with the class slots gone and `look: "<name>"` set
 *   corpus/converted/looks.html.json           name → the classes, verbatim (an html theme's `looks`)
 *   corpus/converted/looks.native.js           name → portable styles (a native theme's `looks`), as a module
 *   corpus/converted/report.md                 what was converted, and what could not be
 *
 * The control JSON carries only a name; what a name draws is each renderer's
 * own table, generated here from the same set. Names are the loader's
 * content-addressed ones (`look-3fa9…`, or a lone typography class as itself)
 * unless `corpus/looks/names.json` maps one to a name you prefer.
 *
 * The native table needs the host's own class names (its typography:
 * `title1`, `body`…) from `corpus/looks/classNames.json` — a map from the
 * class to a portable style — and anything the converter cannot express can be
 * written by hand in `corpus/looks/native-overrides.json` (name → part →
 * style), which wins over the generated part.
 *
 *   rushx convert-looks [<dir-or-file>...]     default ./corpus
 *   rushx convert-looks --json                 the summary as JSON (what `gates` reads)
 *
 * Everything stays under `corpus/`, which is gitignored: it is other
 * repositories' forms, and this repository is public.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { ClassLook, PortableStyle } from "@rx-controls/forms-react";
import { legacyLook } from "@rx-controls/forms-json";
import { walkFiles } from "./corpus.js";
import { tailwindPartCode, tailwindPieces } from "./convert/tailwind.js";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
let roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];
if (roots.length === 0) {
  console.error("usage: convert-looks [<dir-or-file>...]  (default: ./corpus)");
  process.exit(2);
}
const base = existsSync("corpus") ? "corpus" : ".";
const outDir = join(base, "converted");
const readJson = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;

const names = readJson<Record<string, string>>(join(base, "looks", "names.json"), {});
const classNames = readJson<Record<string, PortableStyle>>(join(base, "looks", "classNames.json"), {});
const overrides = readJson<Record<string, Record<string, PortableStyle>>>(
  join(base, "looks", "native-overrides.json"),
  {},
);

const RESERVED = new Set(["primary", "secondary", "link"]);
const SLOTS = ["styleClass", "textClass", "layoutClass", "labelClass", "labelTextClass"] as const;
const OPTION_SLOTS = ["entryWrapperClass", "selectedClass", "notSelectedClass"] as const;

/** name → what it draws, and how many controls use it. */
const looks = new Map<string, { parts: ClassLook; uses: number; derived: string }>();
const problems: string[] = [];
let controls = 0;
let converted = 0;

type Def = Record<string, unknown> & { type?: string; children?: Def[] };

function convert(defs: Def[], form: string): void {
  for (const d of defs) {
    controls++;
    const ro = (d.renderOptions ?? {}) as Record<string, unknown>;
    const labelled = d.type === "Data" || d.type === "Group";
    const derived = legacyLook(
      d.type ?? "",
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
      converted++;
      const name = names[derived.name] ?? derived.name;
      if (RESERVED.has(name)) problems.push(`${form}: "${name}" is a reserved look name (an action emphasis)`);
      const known = looks.get(name);
      if (known && known.derived !== derived.name)
        problems.push(`"${name}" names two different looks (${known.derived}, ${derived.name}) — names.json maps both to it`);
      const entry = known ?? { parts: derived.parts, uses: 0, derived: derived.name };
      entry.uses++;
      looks.set(name, entry);
      d.look = name;
    }
    for (const s of SLOTS) delete d[s];
    for (const s of OPTION_SLOTS) delete ro[s];
    convert(d.children ?? [], form);
  }
}

let formCount = 0;
for (const root of roots)
  for (const path of walkFiles(root)) {
    if (path.includes(join("corpus", "looks")) || path.includes(join("corpus", "converted"))) continue;
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const list = Array.isArray(raw)
      ? (raw as Def[])
      : raw && typeof raw === "object" && Array.isArray((raw as { controls?: unknown }).controls)
        ? ((raw as { controls: Def[] }).controls)
        : undefined;
    if (!list) continue;
    formCount++;
    const rel = relative(base, path);
    convert(list, rel);
    const file = join(outDir, "forms", rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
  }

// ── the two tables ────────────────────────────────────────────────────
const sorted = [...looks.entries()].sort((a, b) => b[1].uses - a[1].uses || a[0].localeCompare(b[0]));
const html: Record<string, ClassLook> = {};
for (const [name, l] of sorted) html[name] = l.parts;

/** Every token that could not be converted, with why, by the controls it touches. */
const unconverted = new Map<string, { why: string; uses: number }>();
const colours = new Map<string, number>();
const nativeLines: string[] = [];
for (const [name, l] of sorted) {
  const parts: string[] = [];
  for (const [part, value] of Object.entries(l.parts)) {
    const replace = typeof value === "object" && value !== null && "replace" in value;
    const classes = replace ? String((value as { replace: unknown }).replace) : String(value);
    const options = {
      named: classNames,
      onUnknown: (token: string, why: string) => {
        const u = unconverted.get(token) ?? { why, uses: 0 };
        u.uses += l.uses;
        unconverted.set(token, u);
      },
    };
    for (const piece of tailwindPieces(classes, { ...options, onUnknown: undefined }))
      for (const v of Object.values(piece.style))
        if (typeof v === "string" && v.startsWith("$")) {
          const c = v.slice(1).split("/")[0];
          colours.set(c, (colours.get(c) ?? 0) + l.uses);
        }
    const code = overrides[name]?.[part] !== undefined ? JSON.stringify(overrides[name][part]) : tailwindPartCode(classes, options);
    parts.push(`${JSON.stringify(part)}: ${replace ? `{ replace: ${code} }` : code}`);
  }
  nativeLines.push(`  ${JSON.stringify(name)}: { ${parts.join(", ")} },`);
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "looks.html.json"), JSON.stringify(html, null, 2) + "\n");
writeFileSync(
  join(outDir, "looks.native.js"),
  `// Generated by \`rushx convert-looks\`: a native theme's \`looks\`. Colours are theme tokens (\`$accent\`),\n` +
    `// defined in the theme's \`tokens.colors\`; a function part reads the element's state (\`s.width\`, \`s.pressed\`).\n` +
    `export const looks = {\n${nativeLines.join("\n")}\n};\n`,
);

const unconvertedList = [...unconverted.entries()].sort((a, b) => b[1].uses - a[1].uses);
const report = [
  "# Looks conversion report",
  "",
  `${formCount} forms · ${controls} controls · ${converted} carry a look · ${looks.size} distinct looks`,
  `${unconvertedList.length} class tokens could not be converted for native (listed below); html carries every class verbatim`,
  "",
  ...(problems.length ? ["## Problems", "", ...problems.map((p) => `- ${p}`), ""] : []),
  "## Not converted for native",
  "",
  "Name the host's own classes in `corpus/looks/classNames.json`; hand-write the rest in `native-overrides.json`.",
  "",
  ...unconvertedList.map(([t, u]) => `- \`${t}\` ×${u.uses} — ${u.why}`),
  "",
  "## Colour tokens the native theme must define",
  "",
  ...[...colours.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `- \`${c}\` ×${n}`),
];
writeFileSync(join(outDir, "report.md"), report.join("\n") + "\n");

if (asJson) {
  console.log(
    JSON.stringify({
      forms: formCount,
      looks: looks.size,
      unconverted: unconvertedList.length,
      problems: problems.length,
    }),
  );
} else {
  console.log(report.slice(0, 4).join("\n"));
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(`\nwrote ${outDir}/ (forms/, looks.html.json, looks.native.js, report.md)`);
}
process.exit(problems.length ? 1 : 0);
