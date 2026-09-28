/// <reference types="vite/client" />
import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createControlContext } from "@rx-controls/core";
import { ControlContextProvider, useControl } from "@rx-controls/react";
import { FormProvider, type FormRenderers } from "../framework/index.js";
import { htmlRenderers } from "../impls/html.js";
import { DefaultVisibility } from "../impls/shared.js";
import { HtmlThemeProvider } from "../impls/htmlTheme.js";
import { JsonForm } from "../loader/JsonForm.js";
import type { ControlDefinition, SchemaField } from "../loader/json.js";
import { pocHost } from "../loader/pocHost.js";
import { formStyles, overlayFor, serviceTasTheme } from "./theme.js";
import "./servicetas.css";

/**
 * The html implementation under ServiceTas's theme, on a page of its own:
 * Bootstrap 3, the portal's `theme.css` and a Tailwind build are global
 * stylesheets, and would restyle the POC's demo chrome if they shared its page.
 * Compare against `apps/legacy-compare` (port 3002), which renders the same
 * JSON through legacy on the same css baseline.
 */
interface CorpusFile {
  controls: ControlDefinition[];
  fields: SchemaField[];
  source: string;
  style?: string;
}

const files = import.meta.glob<CorpusFile>("../../corpus/servicetas/*.json", {
  eager: true,
  import: "default",
});
const forms = Object.entries(files)
  .map(([path, file]) => ({
    name: path.replace(/^.*\//, "").replace(/\.json$/, ""),
    file,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Legacy had no exit animation, and the fade wrapper is a <div> that would
// break inline prose on a page without `demo.css`. A renderer swap, not a
// theme slot: the theme holds classes, the registry holds components.
const serviceTasRenderers: FormRenderers = {
  ...htmlRenderers,
  name: "html · ServiceTas",
  visibility: DefaultVisibility,
};

const AUTO = "(form's own)";

function Page() {
  const initial = new URLSearchParams(location.search).get("form");
  const [name, setName] = useState(
    forms.find((f) => f.name === initial)?.name ??
      forms.find((f) => f.name === "Fire")?.name ??
      forms[0]?.name ??
      "",
  );
  const [styleChoice, setStyleChoice] = useState(AUTO);
  const current = forms.find((f) => f.name === name);
  if (!current)
    return <p>No corpus extracted — run `rushx extract-corpus` (README).</p>;
  const style = styleChoice === AUTO ? current.file.style : styleChoice;
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-baseline gap-4 mb-4 flex-wrap">
          <h1 className="text-2xl font-bold text-zinc-900">{name}</h1>
          <label className="flex items-center gap-2 text-sm">
            <span>Form</span>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                history.replaceState(null, "", `?form=${e.target.value}`);
              }}
            >
              {forms.map((f) => (
                <option key={f.name}>{f.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>formStyles overlay</span>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1"
              value={styleChoice}
              onChange={(e) => setStyleChoice(e.target.value)}
            >
              <option>{AUTO}</option>
              {Object.keys(formStyles).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <code className="text-xs text-zinc-500">
              {style ?? "none — base only"}
            </code>
          </label>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          <FormProvider renderers={serviceTasRenderers}>
            <HtmlThemeProvider theme={serviceTasTheme}>
              <HtmlThemeProvider theme={overlayFor(style)}>
                <CorpusForm key={name} file={current.file} />
              </HtmlThemeProvider>
            </HtmlThemeProvider>
          </FormProvider>
        </div>
      </div>
    </div>
  );
}

function CorpusForm({ file }: { file: CorpusFile }) {
  const data = useControl<Record<string, unknown>>({});
  return (
    <JsonForm
      {...pocHost}
      controls={file.controls}
      schema={file.fields}
      data={data}
      actionHandler={(id) => () => console.log(`action: ${id}`)}
    />
  );
}

function App() {
  const ctx = useMemo(() => createControlContext(), []);
  return (
    <ControlContextProvider value={ctx}>
      <Page />
    </ControlContextProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
