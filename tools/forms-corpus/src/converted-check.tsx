/**
 * The converted check: does a form that names its looks draw what the
 * original drew?
 *
 * Every corpus form is drawn twice under html, under the default and the
 * Tailwind theme: as it is, the loader deriving a look from each control's
 * class slots; and as `rushx convert-looks` wrote it — the class slots gone,
 * `look` set — under a theme that adds the generated html table. The markup
 * must be identical, apart from the look names (the conversion may rename
 * them). Anything printed to the console fails.
 *
 * Run `rushx convert-looks` first.
 *
 *   rushx converted-check [<dir>]     summary; default ./corpus
 *   rushx converted-check --json      the summary as JSON
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tailwindHtmlTheme, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { renderForm } from "./render.js";
import { loadForm, walkFiles } from "./corpus.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const base = args.find((a) => !a.startsWith("--")) ?? "corpus";
const converted = join(base, "converted");
if (!existsSync(join(converted, "looks.html.json"))) {
  console.error("No converted looks: run `rushx convert-looks` first.");
  process.exit(2);
}
const sidecar: PartialHtmlTheme = {
  looks: JSON.parse(readFileSync(join(converted, "looks.html.json"), "utf8")),
} as PartialHtmlTheme;

const themes: [string, PartialHtmlTheme][] = [
  ["default", {}],
  ["tailwind", tailwindHtmlTheme as PartialHtmlTheme],
];
/**
 * Look names differ by design; everything else must not. Class order carries
 * no meaning (a look is named by its classes sorted, so two controls writing
 * them in different orders share one), and React's generated ids count up
 * across the process, so each is renamed by first appearance.
 */
const plain = (html: string) => {
  const ids = new Map<string, number>();
  return html
    .replace(/ data-look="[^"]*"/g, "")
    .replace(/ class="([^"]*)"/g, (_, v: string) => ` class="${v.split(/\s+/).filter(Boolean).sort().join(" ")}"`)
    .replace(/_r_[0-9a-z]+_/g, (id) => `_r${ids.get(id) ?? ids.set(id, ids.size).get(id)}_`);
};

// The native table is generated code: it must load, and every part must evaluate to a style.
const nativeProblems: string[] = [];
let nativeParts = 0;
{
  const { looks } = (await import(pathToFileURL(resolve(converted, "looks.native.js")).href)) as {
    looks: Record<string, Record<string, unknown>>;
  };
  const states = [
    { invalid: false, disabled: false, focused: false, pressed: false, hovered: false, width: 0 },
    { invalid: true, disabled: true, focused: true, pressed: true, hovered: true, width: 1400 },
  ];
  for (const [name, parts] of Object.entries(looks))
    for (const [part, value] of Object.entries(parts)) {
      nativeParts++;
      const inner = value && typeof value === "object" && "replace" in value ? (value as { replace: unknown }).replace : value;
      try {
        for (const s of states) {
          const r = typeof inner === "function" ? inner(s) : inner;
          if (!r || typeof r !== "object") throw new Error("not a style");
        }
      } catch (e) {
        nativeProblems.push(`${name}.${part}: ${(e as Error).message}`);
      }
    }
}

const different: { form: string; theme: string; at: string }[] = [];
const printed: { form: string; theme: string; message: string }[] = [];
let runs = 0;
for (const path of walkFiles(base)) {
  const original = loadForm(path);
  const convertedForm = loadForm(join(converted, "forms", relative(base, path)));
  if (!original || !convertedForm) continue;
  for (const [themeName, theme] of themes) {
    runs++;
    const a = await renderForm(original, [theme]);
    const b = await renderForm(convertedForm, [theme, sidecar]);
    const x = plain(a.html);
    const y = plain(b.html);
    if (x !== y) {
      let i = 0;
      while (i < x.length && x[i] === y[i]) i++;
      different.push({ form: relative(process.cwd(), path), theme: themeName, at: `…${x.slice(Math.max(0, i - 60), i + 60)}\n    vs …${y.slice(Math.max(0, i - 60), i + 60)}` });
    }
    for (const m of b.logged) printed.push({ form: relative(process.cwd(), path), theme: themeName, message: m });
  }
}

if (json) console.log(JSON.stringify({ runs, different: different.length, printed: printed.length, nativeParts, nativeProblems: nativeProblems.length }));
else {
  console.log(
    `${runs} runs: ${runs - different.length} identical to the original, ${different.length} different; ${printed.length} console messages`,
  );
  console.log(`native table: ${nativeParts} parts evaluated, ${nativeProblems.length} failed`);
  for (const p of nativeProblems.slice(0, 5)) console.log(`  ✗ ${p}`);
  for (const d of different.slice(0, 10)) console.log(`\n${d.form} [${d.theme}]\n    ${d.at}`);
  for (const p of printed.slice(0, 10)) console.log(`\n${p.form} [${p.theme}] ${p.message.slice(0, 200)}`);
}
