"use client";

/**
 * The html implementation under ServiceTas's theme, over the ServiceTas
 * corpus, for side-by-side comparison with `apps/legacy-compare` (port 3002),
 * which renders the same JSON through legacy on the same css baseline.
 *
 * The theme is `forms-html`'s ServiceTas fixture and the host is the corpus
 * tooling's stand-in host — the same two the tests and the gates use, so
 * what is compared here is what is checked there.
 */

import { useEffect, useState } from "react";
import {
  ControlContextProvider,
  createControlContext,
  useControl,
} from "@rx-controls/react";
import { FormProvider, type FormRenderers } from "@rx-controls/forms-react";
import {
  DefaultVisibility,
  htmlRenderers,
  HtmlThemeProvider,
  tailwindHtmlTheme,
} from "@rx-controls/forms-html";
import { JsonForm } from "@rx-controls/forms-json";
import type { ControlDefinition, SchemaField } from "@rx-controls/forms-schema";
import {
  formStyles,
  overlayFor,
  serviceTasOverlay,
} from "../../../../../../../packages/forms-html/test/fixtures/serviceTasTheme";
import { standInHost } from "rxc-forms-corpus/host";

interface CorpusFile {
  controls: ControlDefinition[];
  fields: SchemaField[];
  style?: string;
}
interface CorpusForm {
  name: string;
  file: CorpusFile;
}

// Legacy had no exit animation: a renderer swap, not a theme slot — the
// theme holds classes, the registry holds components.
const serviceTasRenderers: FormRenderers = {
  ...htmlRenderers,
  name: "html · ServiceTas",
  visibility: DefaultVisibility,
};

const AUTO = "(form's own)";

export default function ServiceTasPage() {
  const [ctx] = useState(createControlContext);
  const [forms, setForms] = useState<CorpusForm[]>();
  useEffect(() => {
    void fetch("/v2/servicetas/corpus")
      .then((r) => r.json() as Promise<CorpusForm[]>)
      .then(setForms);
  }, []);
  return (
    <ControlContextProvider value={ctx}>
      {forms && <Page forms={forms} />}
    </ControlContextProvider>
  );
}

function Page({ forms }: { forms: CorpusForm[] }) {
  const [name, setName] = useState(() => {
    const asked = new URLSearchParams(location.search).get("form");
    return (
      forms.find((f) => f.name === asked)?.name ??
      forms.find((f) => f.name === "Fire")?.name ??
      forms[0]?.name ??
      ""
    );
  });
  const [styleChoice, setStyleChoice] = useState(AUTO);
  const current = forms.find((f) => f.name === name);
  if (!current)
    return (
      <p className="p-6">
        No corpus extracted — run <code>rushx extract-corpus</code> in
        tools/forms-corpus.
      </p>
    );
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
            <HtmlThemeProvider theme={tailwindHtmlTheme}>
              <HtmlThemeProvider theme={serviceTasOverlay}>
                <HtmlThemeProvider theme={overlayFor(style)}>
                  <Loaded key={name} file={current.file} />
                </HtmlThemeProvider>
              </HtmlThemeProvider>
            </HtmlThemeProvider>
          </FormProvider>
        </div>
      </div>
    </div>
  );
}

function Loaded({ file }: { file: CorpusFile }) {
  const data = useControl<Record<string, unknown>>({});
  return (
    <JsonForm
      {...standInHost}
      controls={file.controls}
      schema={file.fields}
      data={data}
      actionHandler={(id) => () => console.log(`action: ${id}`)}
    />
  );
}
