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
 * unless `sidecar/names.json` maps one to a name you prefer.
 *
 * The native table needs the host's own class names (its typography:
 * `title1`, `body`…) from `sidecar/classNames.json` — a map from the
 * class to a portable style — and anything the converter cannot express can be
 * written by hand in `sidecar/native-overrides.json` (name → part →
 * style), which wins over the generated part. `sidecar/baseClasses.json` (part →
 * classes) is what the host's renderer gives each element itself (ServiceTas's
 * `layout.className` on the shell): a merged part gives way to it where CSS would. A key
 * may name the kind of control first — `Group.control` (schemas-rn's `standardClassName`,
 * a standard group's body), `DisplayOnly.shell` (`displayOnlyClass`, which replaces the
 * layout's class on a display-only field) — and wins over the bare part for that kind.
 * `sidecar/nativeHost.json` is the host's NativeWind setup: `rem`, 14 unless its
 * `inlineRem` says otherwise, which every rem-based utility scales by; and `undrawn`,
 * the parts the host's renderer never draws for a kind of control — schemas-rn draws an
 * inline group as a bare Text given only its text class, so its `styleClass` (the look's
 * `control`) shows nowhere on a device.
 *
 *   rushx convert-looks [<dir-or-file>...]     default ./corpus
 *   rushx convert-looks --json                 the summary as JSON (what `gates` reads)
 *
 * Everything stays under `corpus/`, which is gitignored: it is other
 * repositories' forms, and this repository is public.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { ClassLook, PortableStyle } from "@rx-controls/forms-react";
import { legacyIconClassSlot, legacyLook } from "@rx-controls/forms-json";
import { walkFiles } from "./corpus.js";
import { tailwindPartCode, tailwindPieces } from "./convert/tailwind.js";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
// One look per control (its classes whole, named by their hash) rather than a list of shared pieces.
const whole = args.includes("--whole");
let roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];
if (roots.length === 0) {
  console.error("usage: convert-looks [<dir-or-file>...]  (default: ./corpus)");
  process.exit(2);
}
const base = existsSync("corpus") ? "corpus" : ".";
const outDir = join(base, "converted");
// The hand-written inputs, committed beside the tool: they are the host's design, not its forms.
const sidecar = join(dirname(fileURLToPath(import.meta.url)), "..", "sidecar");
const readJson = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;

const names = readJson<Record<string, string>>(join(sidecar, "names.json"), {});
const classNames = readJson<Record<string, PortableStyle>>(join(sidecar, "classNames.json"), {});
const baseClasses = readJson<Record<string, string>>(join(sidecar, "baseClasses.json"), {});
const nativeHost = readJson<{ rem?: number; undrawn?: Record<string, string[]> }>(join(sidecar, "nativeHost.json"), {});
const overrides = readJson<Record<string, Record<string, PortableStyle>>>(
  join(sidecar, "native-overrides.json"),
  {},
);

const RESERVED = new Set(["primary", "secondary", "link"]);
const SLOTS = ["styleClass", "textClass", "layoutClass", "labelClass", "labelTextClass"] as const;
const OPTION_SLOTS = ["entryWrapperClass", "selectedClass", "notSelectedClass"] as const;

/** name → what it draws, and the controls that use it with what each is (see {@link controlKind}). */
const looks = new Map<string, { parts: ClassLook; uses: number; derived: string; defs: { d: Def; kind: string }[] }>();

/**
 * What a control is, as far as the host's own classes go: they differ for a
 * standard group's body and a display-only field's layout (`baseClasses.json`).
 */
function controlKind(d: Def): string {
  const ro = (d.renderOptions ?? {}) as Record<string, unknown>;
  const go = (d.groupOptions ?? ro.groupOptions ?? {}) as Record<string, unknown>;
  if (d.type === "Group") return !go.type || go.type === "Standard" ? "Group" : `Group:${String(go.type)}`;
  if (d.type === "Data" && ro.type === "DisplayOnly") return "DisplayOnly";
  // A button's text sits beside its emphasis's own text classes (primaryTextClass…).
  if (d.type === "Action") return `Action:${String(d.actionStyle ?? "Button")}`;
  return String(d.type ?? "");
}
const problems: string[] = [];
let controls = 0;
let converted = 0;

type Def = Record<string, unknown> & { type?: string; children?: Def[] };

type PartValue = ClassLook[keyof ClassLook];

/** What a class does, for splitting a part into pieces: a host's own class, a text utility, or the box. */
const CATEGORIES = ["host", "box", "text"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * What a class does, for splitting a part into pieces: a host's own class, a text utility, or
 * the box. Finer (layout, spacing, surface apart) measured no better on ServiceTas's corpus —
 * 431 looks against 434, its variety being in the values (nine gaps, several greys) — and made
 * the lists longer.
 */
function category(token: string): Category {
  const u = token.split(/:(?![^[]*\])/).pop()!.replace(/^!/, "");
  if (u in classNames) return "host";
  if (/^(text-|font-|leading-|tracking-|underline$|line-through$|no-underline$|italic$|not-italic$|uppercase$|lowercase$|capitalize$|truncate$)/.test(u))
    return "text";
  return "box";
}

/**
 * A control's look as a list of shared pieces, each one part's classes of one kind (see
 * {@link category}): `body-bold`, `flex-flex-col-gap-16`, `text-accent-underline`.
 * In CSS's order — a host class under utilities — and a replace on the part's first piece, which
 * drops the theme's own before the rest layer on.
 */
function pieces(parts: ClassLook): { part: string; value: PartValue }[] {
  const out: { part: string; value: PartValue }[] = [];
  for (const [part, value] of Object.entries(parts)) {
    if (value === undefined) continue;
    const replace = typeof value === "object" && value !== null && "replace" in value;
    const classes = (replace ? String((value as { replace: unknown }).replace) : String(value)).split(/\s+/).filter(Boolean);
    const groups = CATEGORIES
      .map((c) => classes.filter((t) => category(t) === c).sort().join(" "))
      .filter(Boolean);
    if (!groups.length) {
      if (replace) out.push({ part, value: { replace: "" } as PartValue });
      continue;
    }
    groups.forEach((g, i) => out.push({ part, value: (replace && i === 0 ? { replace: g } : g) as PartValue }));
  }
  return out;
}

/** A piece's default name: its classes as words (`flex-col-gap-16`), a part's other than the text's and control's after it, a replace `only-` before it. */
function pieceName(part: string, value: PartValue): string {
  const replace = typeof value === "object" && value !== null && "replace" in value;
  const classes = replace ? String((value as { replace: unknown }).replace) : String(value);
  const slug =
    classes
      .split(/\s+/)
      .filter(Boolean)
      .map((t) =>
        t
          .replace(/^!/, "important-")
          .replace(/\[(-?[\d.]+)(px)?\]/g, "$1")
          .replace(/\[#([0-9a-fA-F]+)\]/g, "$1")
          .replace(/[^a-zA-Z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      )
      .join("-") || "none";
  const where = part === "text" || part === "control" ? "" : `-${part.toLowerCase()}`;
  return `${replace ? "only-" : ""}${slug}${where}`;
}

/** A piece's identity: its part and its value. */
const pieceKey = (part: string, value: PartValue) => JSON.stringify([part, value]);
const pieceNames = new Map<string, string>();

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
        iconClass: legacyIconClassSlot(d),
      },
      labelled,
    );
    if (derived && !whole) {
      converted++;
      const list: string[] = [];
      for (const { part, value } of pieces(derived.parts)) {
        const key = pieceKey(part, value);
        let name = pieceNames.get(key);
        if (!name) {
          // Two pieces with one default name (two parts' same classes, `text-x` and `!text-x`): the
          // later named by its part, then numbered.
          const taken = new Set(pieceNames.values());
          const stem = pieceName(part, value);
          name = stem;
          if (taken.has(name)) name = `${stem}-${part.toLowerCase()}`;
          for (let n = 2; taken.has(name); n++) name = `${stem}-${n}`;
          pieceNames.set(key, name);
        }
        const entry = looks.get(name) ?? { parts: { [part]: value } as ClassLook, uses: 0, derived: key, defs: [] };
        entry.uses++;
        entry.defs.push({ d, kind: controlKind(d) });
        looks.set(name, entry);
        if (!list.includes(name)) list.push(name);
      }
      d.look = list.length === 1 ? list[0] : list;
    } else if (derived) {
      converted++;
      const name = names[derived.name] ?? derived.name;
      if (RESERVED.has(name)) problems.push(`${form}: "${name}" is a reserved look name (an action emphasis)`);
      const known = looks.get(name);
      if (known && known.derived !== derived.name)
        problems.push(`"${name}" names two different looks (${known.derived}, ${derived.name}) — names.json maps both to it`);
      const entry = known ?? { parts: derived.parts, uses: 0, derived: derived.name, defs: [] };
      entry.uses++;
      entry.defs.push({ d, kind: controlKind(d) });
      looks.set(name, entry);
      d.look = name;
    }
    for (const s of SLOTS) delete d[s];
    for (const s of OPTION_SLOTS) delete ro[s];
    // An icon's classes are in the look's `icon` part now, whichever icon carried them.
    delete (d.displayData as Record<string, unknown> | undefined)?.iconClass;
    for (const a of (d.adornments ?? []) as Record<string, unknown>[]) if (a.type === "Icon") delete a.iconClass;
    convert(d.children ?? [], form);
  }
}

let formCount = 0;
const outputs: { file: string; raw: unknown }[] = [];
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
    // Written once the tables are made: a use may be renamed there (see the native table).
    outputs.push({ file: join(outDir, "forms", rel), raw });
  }

// ── the two tables ────────────────────────────────────────────────────
const sorted = [...looks.entries()].sort((a, b) => b[1].uses - a[1].uses || a[0].localeCompare(b[0]));
const html: Record<string, ClassLook> = {};
for (const [name, l] of sorted) html[name] = l.parts;

/** Every token that could not be converted, with why, by the controls it touches. */
const unconverted = new Map<string, { why: string; uses: number }>();
const colours = new Map<string, number>();
const nativeLines: string[] = [];

/**
 * A look's native code for one kind of control: each part beside the host's own classes for
 * that kind (`baseClasses.json`), nothing for a part the host never draws for it (`undrawn`).
 */
function nativeLookCode(name: string, l: { parts: ClassLook; uses: number }, kind: string, report: boolean): string {
  const parts: string[] = [];
  for (const [part, value] of Object.entries(l.parts)) {
    const replace = typeof value === "object" && value !== null && "replace" in value;
    const classes = replace ? String((value as { replace: unknown }).replace) : String(value);
    const options = {
      named: classNames,
      base: replace ? undefined : (baseClasses[`${kind}.${part}`] ?? baseClasses[part]),
      rem: nativeHost.rem,
      onUnknown: report
        ? (token: string, why: string) => {
            const u = unconverted.get(token) ?? { why, uses: 0 };
            u.uses += l.uses;
            unconverted.set(token, u);
          }
        : undefined,
    };
    if (report)
      for (const piece of tailwindPieces(classes, { ...options, onUnknown: undefined }))
        for (const v of Object.values(piece.style))
          if (typeof v === "string" && v.startsWith("$")) {
            const c = v.slice(1).split("/")[0];
            colours.set(c, (colours.get(c) ?? 0) + l.uses);
          }
    const code =
      overrides[name]?.[part] !== undefined
        ? JSON.stringify(overrides[name][part])
        : nativeHost.undrawn?.[kind]?.includes(part)
          ? "{}"
          : tailwindPartCode(classes, options);
    parts.push(`${JSON.stringify(part)}: ${replace ? `{ replace: ${code} }` : code}`);
  }
  return `{ ${parts.join(", ")} }`;
}

// A look whose uses sit beside different host classes can draw differently for each: the most
// common use keeps the name, and a use that converts differently gets the name qualified by its
// kind (`headline@action-button`), its forms renamed and html given the same classes under it.
const slug = (kind: string) => kind.toLowerCase().replace(/[^a-z0-9]+/g, "-");
for (const [name, l] of sorted) {
  const byKind = new Map<string, Def[]>();
  for (const { d, kind } of l.defs) byKind.set(kind, [...(byKind.get(kind) ?? []), d]);
  const kinds = [...byKind.entries()].sort((a, b) => b[1].length - a[1].length);
  const main = nativeLookCode(name, l, kinds[0]?.[0] ?? "", true);
  nativeLines.push(`  ${JSON.stringify(name)}: ${main},`);
  for (const [kind, defs] of kinds.slice(1)) {
    const code = nativeLookCode(name, l, kind, false);
    if (code === main) continue;
    const qualified = `${name}@${slug(kind)}`;
    for (const d of defs)
      d.look = Array.isArray(d.look) ? (d.look as string[]).map((n) => (n === name ? qualified : n)) : qualified;
    html[qualified] = l.parts;
    nativeLines.push(`  ${JSON.stringify(qualified)}: ${code},`);
  }
}
for (const { file, raw } of outputs) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
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
  "Name the host's own classes in `sidecar/classNames.json`; hand-write the rest in `native-overrides.json`.",
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
