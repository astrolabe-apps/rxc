/**
 * Drawing one corpus form under html, for the checks that compare or inspect
 * what it draws. Loads a DOM first (see `dom.ts`).
 */
import { win } from "./dom.js";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createControlContext } from "@rx-controls/core";
import { ControlContextProvider } from "@rx-controls/react";
import { Form, FormProvider } from "@rx-controls/forms-react";
import { HtmlThemeProvider, htmlRenderers, type PartialHtmlTheme } from "@rx-controls/forms-html";
import { JsonForm } from "@rx-controls/forms-json";
import { standInHost } from "./host/standInHost.js";
import type { FormFile } from "./corpus.js";

/** What a form drew: the markup, how many elements name a look of the form's own, and anything it printed. */
export async function renderForm(
  form: FormFile,
  themes: PartialHtmlTheme[],
): Promise<{ html: string; named: number; logged: string[] }> {
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
    let tree: ReactElement = createElement(Form, {
      clearHidden: true,
      children: createElement(JsonForm, {
        ...standInHost,
        controls: form.controls,
        schema: form.fields,
        data,
        actionHandler: () => () => {},
      }),
    });
    // the first theme outermost, so a later one (a form's looks) is nested inside it
    for (const theme of [...themes].reverse())
      tree = createElement(HtmlThemeProvider, { theme, children: tree });
    root.render(
      createElement(ControlContextProvider, {
        value: ctx,
        children: createElement(FormProvider, { renderers: htmlRenderers, children: tree }),
      }),
    );
    for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 10));
    const html = container.innerHTML;
    // Elements naming a look of the form's own: the three emphases every theme draws are looks too.
    const named = [...html.matchAll(/ data-look="([^"]*)"/g)].filter((m) =>
      m[1].split(" ").some((n) => !["primary", "secondary", "link"].includes(n)),
    ).length;
    return { html, named, logged };
  } finally {
    root.unmount();
    container.remove();
    console.error = saved.error;
    console.warn = saved.warn;
  }
}
