/**
 * The looks check: does the loader's derived looks draw every corpus form?
 *
 * Every corpus form is drawn under the html implementation, under both the
 * default and the Tailwind theme, through `JsonForm`: the loader turns each
 * control's class slots into a look and brings the looks to the implementation
 * (`FormLooksProvider`). The check fails if a form prints anything to the
 * console — a look the implementation could not find, a React warning — or if
 * no element names a look, since a check that never used one proves nothing.
 *
 * (Before the class slots were retired it also compared this markup with what
 * the class slots drew, and found them identical on every form.)
 *
 *   rushx looks-check [<dir-or-file>...]     summary; default ./corpus
 *   rushx looks-check --json                 the summary as JSON
 */
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  tailwindHtmlTheme,
  type PartialHtmlTheme,
} from "@rx-controls/forms-html";
import { renderForm } from "./render.js";
import { loadForm, walkFiles, type FormFile } from "./corpus.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
let roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];

const render = (form: FormFile, theme: PartialHtmlTheme) => renderForm(form, [theme]);

const themes: [string, PartialHtmlTheme][] = [
  ["default", {}],
  ["tailwind", tailwindHtmlTheme as PartialHtmlTheme],
];

const failing: { form: string; theme: string; logged: string[] }[] = [];
let runs = 0;
let named = 0;
for (const root of roots)
  for (const path of walkFiles(root)) {
    if (path.includes(join("corpus", "looks"))) continue;
    const form = loadForm(path);
    if (!form) continue;
    for (const [themeName, theme] of themes) {
      runs++;
      const r = await render(form, theme);
      named += r.named;
      if (r.logged.length) failing.push({ form: relative(process.cwd(), path), theme: themeName, logged: r.logged });
    }
  }

if (json) console.log(JSON.stringify({ runs, failing: failing.length, named }));
else {
  console.log(
    `${runs} runs (${runs / themes.length} forms × ${themes.length} themes): ` +
      `${runs - failing.length} clean, ${failing.length} printed to the console; ${named} elements name a look`,
  );
  for (const f of failing.slice(0, 15)) {
    console.log(`\n${f.form} [${f.theme}]`);
    for (const l of f.logged.slice(0, 3)) console.log("  " + l.slice(0, 200));
  }
}
// `gates` reads the JSON and decides; run by hand, a failure exits non-zero.
process.exit((failing.length || named === 0) && !json ? 1 : 0);
