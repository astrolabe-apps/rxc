"use client";

/**
 * Forms v2 from the real packages: `@rx-controls/forms-react` for the
 * contract and `@rx-controls/forms-html` for the implementation. The same
 * PersonForm the POC built, minus its JSON and corpus tabs (those arrive with
 * `@rx-controls/forms-json` in phase 3). Pair with /v2/compat, the same
 * packages inside a compat-engine app.
 */

import { useState } from "react";
import type { Control } from "@rx-controls/core";
import {
  ControlContextProvider,
  createControlContext,
  useControl,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  ActionOverrideProvider,
  FormProvider,
  StandardActionIds,
  type ActionOverrides,
  type ActionRenderProps,
  type Presence,
} from "@rx-controls/forms-react";
import {
  defaultHtmlTheme,
  htmlRenderers,
  HtmlThemeProvider,
  tailwindHtmlTheme,
} from "@rx-controls/forms-html";
import { PersonForm, personFieldNames, type Person } from "./PersonForm";
import "rxc-forms-conformance/widgets.css";

/** An app overriding one button it never wrote, by id. */
function FancyAdd(p: ActionRenderProps) {
  return (
    <button
      type="button"
      className="rounded-full border-2 border-dashed border-violet-500 px-3 py-1 text-violet-700"
      disabled={p.disabled}
      onClick={p.onClick}
    >
      {"✨"} {p.text}
    </button>
  );
}
// Stable identities: a new object each render would re-render the subtree.
const fancyOverrides: ActionOverrides = { [StandardActionIds.add]: FancyAdd };
const noOverrides: ActionOverrides = {};

const initial: Person = {
  firstName: "",
  lastName: "",
  email: "",
  notes: "",
  rating: undefined,
  hasPets: false,
  pets: [],
  vetName: "",
  status: undefined,
  priority: undefined,
  address: { street: "", city: "" },
  joined: "2024-03-09",
  wizardPage: undefined,
};

export default function V2Page() {
  const [ctx] = useState(createControlContext);
  return (
    <ControlContextProvider value={ctx}>
      <Demo />
    </ControlContextProvider>
  );
}

function Toggle({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => set(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Demo(): Rendered {
  const { rc, rendered, update } = useReactive();
  const data = useControl<Person>(initial);
  const [presence, setPresence] = useState<Presence>("rendered");
  const [readOnly, setReadOnly] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [designMode, setDesignMode] = useState(false);
  const [clearHidden, setClearHidden] = useState(true);
  const [lockPets, setLockPets] = useState(false);
  const [fancyAdd, setFancyAdd] = useState(false);
  const [tailwind, setTailwind] = useState(true);

  const fields = data as unknown as Control<Record<string, unknown>>;
  const rows = personFieldNames.map((name) => {
    const child = fields.fields[name] as Control<unknown>;
    return {
      name,
      value: rc.getValue(child),
      errors: [...new Set(Object.values(rc.getErrors(child)).filter(Boolean))],
      touched: rc.isTouched(child),
      dirty: rc.isDirty(child),
    };
  });

  return rendered(
    <div className="flex min-h-screen gap-6 p-6">
      <aside className="flex w-96 shrink-0 flex-col gap-2 text-sm">
        <h1 className="text-lg font-semibold">Forms v2 — PersonForm</h1>
        <label className="flex items-center gap-2">
          <span>Email presence</span>
          <select
            className="rounded border px-1"
            value={presence}
            onChange={(e) => setPresence(e.target.value as Presence)}
          >
            <option value="rendered">rendered</option>
            <option value="silent">silent — off screen, still validates</option>
            <option value="hidden">hidden — off screen, no validation</option>
          </select>
        </label>
        <Toggle label="tailwindHtmlTheme (off: rxf- hooks only)" value={tailwind} set={setTailwind} />
        <Toggle label="<Form readOnly>" value={readOnly} set={setReadOnly} />
        <Toggle label="<Form disabled>" value={disabled} set={setDisabled} />
        <Toggle label="Design mode" value={designMode} set={setDesignMode} />
        <Toggle label="<Form clearHidden>" value={clearHidden} set={setClearHidden} />
        <Toggle label="Lock the pets region (readOnly)" value={lockPets} set={setLockPets} />
        <Toggle label="Override the “add” action by id" value={fancyAdd} set={setFancyAdd} />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() =>
              update((wc) => {
                wc.setTouched(data, true);
                wc.validate(data);
              })
            }
          >
            Touch all + validate
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => update((wc) => wc.reset(data, initial))}
          >
            Reset
          </button>
        </div>
        <table className="mt-2 w-full border-collapse text-xs">
          <thead>
            <tr className="text-left">
              <th>field</th>
              <th>value</th>
              <th>flags</th>
              <th>errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.name}
                className={r.errors.length ? "bg-red-50" : undefined}
              >
                <td className="pr-2">{r.name}</td>
                <td className="max-w-32 truncate pr-2">
                  {JSON.stringify(r.value)}
                </td>
                <td className="pr-2">
                  {[r.touched && "touched", r.dirty && "dirty"]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td>{r.errors.join("; ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
      <main className="min-w-0 flex-1">
        <HtmlThemeProvider
          theme={tailwind ? tailwindHtmlTheme : defaultHtmlTheme}
        >
          <FormProvider renderers={htmlRenderers}>
            <ActionOverrideProvider
              value={fancyAdd ? fancyOverrides : noOverrides}
            >
              <PersonForm
                data={data}
                emailPresence={presence}
                lockPets={lockPets}
                readOnly={readOnly}
                disabled={disabled}
                clearHidden={clearHidden}
                designMode={designMode}
              />
            </ActionOverrideProvider>
          </FormProvider>
        </HtmlThemeProvider>
      </main>
    </div>,
  );
}
