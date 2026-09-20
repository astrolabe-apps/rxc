import { useMemo, useState } from "react";
import type { Control } from "@rx-controls/core";
import { createControlContext } from "@rx-controls/core";
import {
  ControlContextProvider,
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
} from "./framework/index.js";
import { htmlRenderers } from "./impls/html.js";
import { muiRenderers } from "./impls/mui.js";
import { antdRenderers } from "./impls/antd.js";
import { mantineRenderers } from "./impls/mantine.js";
import { PersonForm, personFieldNames, type Person } from "./PersonForm.js";
import "./demo.css";

const impls = [htmlRenderers, muiRenderers, antdRenderers, mantineRenderers];

/** An app overriding one button it never wrote, by id. */
function FancyAdd(p: ActionRenderProps) {
  return (
    <button className="ff-fancy-add" disabled={p.disabled} onClick={p.onClick}>
      {"\u2728"} {p.text}
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
};

export default function App() {
  const ctx = useMemo(() => createControlContext(), []);
  return (
    <ControlContextProvider value={ctx}>
      <Demo />
    </ControlContextProvider>
  );
}

function Demo(): Rendered {
  const { rc, rendered, update } = useReactive();
  const data = useControl<Person>(initial);
  const [implName, setImplName] = useState(impls[0].name);
  const [presence, setPresence] = useState<Presence>("rendered");
  const [readOnly, setReadOnly] = useState(false);
  const [clearHidden, setClearHidden] = useState(true);
  const [lockPets, setLockPets] = useState(false);
  const [fancyAdd, setFancyAdd] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [designMode, setDesignMode] = useState(false);

  const impl = impls.find((i) => i.name === implName) ?? impls[0];
  const fields = data as unknown as Control<Record<string, unknown>>;
  const rows = personFieldNames.map((name) => {
    const child = fields.fields[name] as Control<unknown>;
    return {
      name,
      value: rc.getValue(child),
      errors: Object.values(rc.getErrors(child)).filter(Boolean),
      touched: rc.isTouched(child),
      dirty: rc.isDirty(child),
    };
  });

  return rendered(
    <div className="page">
      <aside className="panel">
        <h1>Forms v2 — field boundary POC</h1>

        <label className="row">
          <span>Implementation</span>
          <select
            value={implName}
            onChange={(e) => setImplName(e.target.value)}
          >
            {impls.map((i) => (
              <option key={i.name}>{i.name}</option>
            ))}
          </select>
        </label>

        <label className="row">
          <span>Email presence</span>
          <select
            value={presence}
            onChange={(e) => setPresence(e.target.value as Presence)}
          >
            <option value="rendered">rendered</option>
            <option value="silent">silent — off screen, still validates</option>
            <option value="hidden">hidden — off screen, no validation</option>
          </select>
        </label>

        <label className="row check">
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(e) => setReadOnly(e.target.checked)}
          />
          <span>&lt;Form readOnly&gt;</span>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />
          <span>&lt;Form disabled&gt;</span>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={designMode}
            onChange={(e) => setDesignMode(e.target.checked)}
          />
          <span>Design mode chrome</span>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={lockPets}
            onChange={(e) => setLockPets(e.target.checked)}
          />
          <span>Lock the pets region (readOnly)</span>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={fancyAdd}
            onChange={(e) => setFancyAdd(e.target.checked)}
          />
          <span>Override the &ldquo;add&rdquo; action by id</span>
        </label>
        <label className="row check">
          <input
            type="checkbox"
            checked={clearHidden}
            onChange={(e) => setClearHidden(e.target.checked)}
          />
          <span>&lt;Form clearHidden&gt;</span>
        </label>

        <div className="row">
          <button
            type="button"
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
            onClick={() => update((wc) => wc.reset(data, initial))}
          >
            Reset
          </button>
        </div>

        <table className="state">
          <thead>
            <tr>
              <th>field</th>
              <th>value</th>
              <th>flags</th>
              <th>errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={r.errors.length ? "bad" : undefined}>
                <td>{r.name}</td>
                <td>{JSON.stringify(r.value)}</td>
                <td>
                  {[r.touched && "touched", r.dirty && "dirty"]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td>{r.errors.join("; ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Email sits in a <code>Panel</code> — a container implementation, the
          only thing that sets <code>silent</code>. Set it there and clear the
          field: it leaves the screen and stays invalid. Set <code>hidden</code>
          and the error goes away.
        </p>
        <p className="hint">
          Pets is an <code>&lt;Elements&gt;</code> collection — a boundary, so
          the array itself carries the <code>Length 1–3</code> validator.
        </p>
        <p className="hint">
          Vet's name sits in <code>&lt;Contents hidden&gt;</code>, revealed by
          the Has pets checkbox in the form. It stays mounted while hidden,
          which is how it clears its own value — nothing can do that on its
          behalf.
        </p>
      </aside>

      <main className="canvas">
        <FormProvider renderers={impl}>
          <ActionOverrideProvider
            value={fancyAdd ? fancyOverrides : noOverrides}
          >
            <PersonForm
              data={data}
              emailPresence={presence}
              showReference={impl.name === "Ant"}
              lockPets={lockPets}
              readOnly={readOnly}
              disabled={disabled}
              clearHidden={clearHidden}
              designMode={designMode}
            />
          </ActionOverrideProvider>
        </FormProvider>
      </main>
    </div>,
  );
}
