/// <reference types="vite/client" />
import { useMemo, useState } from "react";
import { useControl } from "@rx-controls/react";
import { JsonForm } from "./JsonForm.js";
import type { ControlDefinition, SchemaField } from "./json.js";
import type { LoaderWarning } from "./translate.js";
import { pocHost } from "./pocHost.js";

/**
 * Presentation aid: a real legacy form from the extracted corpus, loaded
 * through the same `<JsonForm>` as the fixture tab. `corpus/` is gitignored
 * and derived (see README) — with no corpus extracted this renders a note
 * rather than a picker.
 */
interface CorpusFile {
  controls: ControlDefinition[];
  fields: SchemaField[];
  source: string;
  schema: string;
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

function countControls(cs: ControlDefinition[]): number {
  return cs.reduce((n, c) => n + 1 + countControls(c.children ?? []), 0);
}

export function CorpusDemo() {
  const [name, setName] = useState(
    forms.find((f) => f.name === "MastSummary")?.name ?? forms[0]?.name ?? "",
  );
  const [showWarnings, setShowWarnings] = useState(false);
  const current = forms.find((f) => f.name === name);
  if (!current) {
    return (
      <p className="ff-plain">
        No corpus extracted — run <code>rushx extract-corpus</code> (README).
      </p>
    );
  }
  return (
    <>
      <div className="ff-corpus-bar">
        <label>
          <span>Legacy form</span>
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {forms.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} · {countControls(f.file.controls)}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showWarnings}
            onChange={(e) => setShowWarnings(e.target.checked)}
          />
          <span>Show what the loader could not translate</span>
        </label>
        <code>{current.file.source}</code>
      </div>
      {/* Keyed so each form gets a fresh data control. */}
      <CorpusForm key={name} file={current.file} showWarnings={showWarnings} />
    </>
  );
}

function CorpusForm({
  file,
  showWarnings,
}: {
  file: CorpusFile;
  showWarnings: boolean;
}) {
  const data = useControl<Record<string, unknown>>({});
  const renderWarnings = useMemo(
    () =>
      showWarnings
        ? (ws: LoaderWarning[]) => <WarningList warnings={ws} />
        : (ws: LoaderWarning[]) => (
            <p className="ff-plain ff-corpus-count">
              {ws.length} thing{ws.length === 1 ? "" : "s"} the loader could not
              translate — rendered with defaults.
            </p>
          ),
    [showWarnings],
  );
  return (
    <JsonForm
      {...pocHost}
      controls={file.controls}
      schema={file.fields}
      data={data}
      actionHandler={(id) => () => console.log(`action: ${id}`)}
      renderWarnings={renderWarnings}
    />
  );
}

function WarningList({ warnings }: { warnings: LoaderWarning[] }) {
  const byKind = new Map<string, number>();
  for (const w of warnings) byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
  return (
    <details className="ff-warnings-box" open>
      <summary>
        {warnings.length} warnings ·{" "}
        {[...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(" · ")}
      </summary>
      <ul className="ff-warnings">
        {warnings.map((w, i) => (
          <li key={i}>
            <code>{w.path}</code> <b>{w.kind}</b>
            {w.subject ? ` · ${w.subject}` : ""} — {w.detail}
          </li>
        ))}
      </ul>
    </details>
  );
}
