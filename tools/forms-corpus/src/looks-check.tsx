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
import { win } from "./dom.js";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createControlContext } from "@rx-controls/core";
import { ControlContextProvider } from "@rx-controls/react";
import { Form, FormProvider } from "@rx-controls/forms-react";
import {
  HtmlThemeProvider,
  htmlRenderers,
  tailwindHtmlTheme,
  type PartialHtmlTheme,
} from "@rx-controls/forms-html";
import { JsonForm } from "@rx-controls/forms-json";
import { standInHost } from "./host/standInHost.js";
import { loadForm, walkFiles, type FormFile } from "./corpus.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
let roots = args.filter((a) => !a.startsWith("--"));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];

async function render(
  form: FormFile,
  theme: PartialHtmlTheme,
): Promise<{ named: number; logged: string[] }> {
  const logged: string[] = [];
  const saved = { error: console.error, warn: console.warn };
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  console.warn = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  const ctx = createControlContext();
  const data = ctx.newControl<unknown>({});
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as Element);
  try {
    root.render(
      createElement(ControlContextProvider, {
        value: ctx,
        children: createElement(FormProvider, {
          renderers: htmlRenderers,
          children: createElement(HtmlThemeProvider, {
            theme,
            children: createElement(Form, {
              clearHidden: true,
              children: createElement(JsonForm, {
                ...standInHost,
                controls: form.controls,
                schema: form.fields,
                data,
                actionHandler: () => () => {},
              }),
            }),
          }),
        }),
      }),
    );
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 10));
    // Elements naming a look of the form's own: the three emphases every theme draws are looks too.
    const named = [...container.innerHTML.matchAll(/ data-look="([^"]*)"/g)].filter((m) =>
      m[1].split(" ").some((n) => !["primary", "secondary", "link"].includes(n)),
    ).length;
    return { named, logged };
  } finally {
    root.unmount();
    container.remove();
    console.error = saved.error;
    console.warn = saved.warn;
  }
}

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
