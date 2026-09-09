"use client";

/**
 * Kitchen-sink port of the legacy @react-typed-forms/core demo onto
 * @rxc/controls. Pair with localhost:3001/controls in the legacy-demos app —
 * the sections mirror it one-for-one.
 *
 * The structural difference is reactivity: legacy tracking is ambient (the
 * SWC plugin instruments `.value` reads), while here every reactive read goes
 * through the `rc` from `useReactive()` and each component closes its render
 * pass with `rendered(…)`. Writes batch through the `update` that same call
 * returns (or `useControlContext().update` in the write-only sections).
 *
 * Surface differences from legacy called out inline:
 *  - no `useValueChangeEffect` — debounce is composed from `useControlEffect`
 *  - no `controlValues` — a computed just reads both controls through its rc
 *  - no `groupedChanges` — a single `update(wc => …)` call batches natively
 */

import { type ReactNode, useRef, useState } from "react";
import {
  ControlContextProvider,
  createControlContext,
  selectableValues,
  ControlCheckbox,
  ControlInput,
  FormEditProvider,
  ControlSelect,
  RenderArrayElements,
  Reactive,
  RenderElements,
  RenderOptional,
  whenAllDefined,
  useAsyncValidator,
  useComputed,
  useControl,
  useControlContext,
  useControlEffect,
  useControlGroup,
  useReactive,
  useFormControlProps,
  useValueWithPrevious,
  useSelectableArray,
  useValidator,
  type Rendered,
} from "@rxc/controls";

// ── Shared chrome (identical classes to the legacy page) ────────────

const inputClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900";
const buttonClass =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50";
const chipClass = "rounded-full px-2 py-0.5 text-xs font-medium";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function StateChips({
  dirty,
  valid,
  touched,
}: {
  dirty: boolean;
  valid: boolean;
  touched?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span
        className={`${chipClass} ${dirty ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
      >
        {dirty ? "dirty" : "clean"}
      </span>
      <span
        className={`${chipClass} ${valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
      >
        {valid ? "valid" : "invalid"}
      </span>
      {touched !== undefined && (
        <span
          className={`${chipClass} ${touched ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-600"}`}
        >
          {touched ? "touched" : "untouched"}
        </span>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-700">
      <span className="w-32 shrink-0">{label}</span>
      {children}
    </label>
  );
}

// ── 1. useControl + ControlInput + setup validators ────────────────────────

interface BasicForm {
  firstName: string;
  lastName: string;
  email: string;
}

function BasicFormSection(): Rendered {
  const { rc, rendered, update } = useReactive();
  const form = useControl<BasicForm>(
    { firstName: "", lastName: "", email: "" },
    {
      fields: {
        lastName: { validator: (v) => (v ? undefined : "Required field") },
        email: {
          validator: (v) => (v.includes("@") ? undefined : "Must contain @"),
        },
      },
    },
  );
  const fields = form.fields;
  const [submitted, setSubmitted] = useState<BasicForm>();

  return rendered(
    <Section
      title="1. useControl + ControlInput + setup validators"
      note="ControlOptions field validators, dirty/valid/touched flags, validate(), markClean(), reset to initial value. One update(wc => …) call is the groupedChanges equivalent — writes batch natively."
    >
      <Labeled label="First name">
        <ControlInput className={inputClass} control={fields.firstName} />
      </Labeled>
      <Labeled label="Last name *">
        <ControlInput className={inputClass} control={fields.lastName} />
        {rc.isTouched(fields.lastName) && rc.getError(fields.lastName) && (
          <span className="text-xs text-red-600">
            {rc.getError(fields.lastName)}
          </span>
        )}
      </Labeled>
      <Labeled label="Email *">
        <ControlInput className={inputClass} type="email" control={fields.email} />
        {rc.isTouched(fields.email) && rc.getError(fields.email) && (
          <span className="text-xs text-red-600">
            {rc.getError(fields.email)}
          </span>
        )}
      </Labeled>
      <StateChips
        dirty={rc.isDirty(form)}
        valid={rc.isValid(form)}
        touched={rc.isTouched(form)}
      />
      <div className="flex gap-2">
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) => {
              wc.setTouched(form, true);
              if (wc.validate(form)) {
                setSubmitted(form.valueNow);
                wc.markClean(form);
              }
            })
          }
        >
          Submit
        </button>
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) => {
              wc.setValue(form, form.initialValueNow);
              wc.setTouched(form, false);
            })
          }
        >
          Reset
        </button>
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) => {
              wc.setValue(fields.firstName, "Jane");
              wc.setValue(fields.lastName, "Doe");
              wc.setValue(fields.email, "jane@doe.example");
            })
          }
        >
          Fill sample (one update batch)
        </button>
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.setDisabled(form, !form.disabledNow))}
        >
          Toggle disabled
        </button>
      </div>
      {submitted && (
        <pre className="rounded bg-zinc-100 p-2 text-xs text-zinc-800">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </Section>,
  );
}

// ── 2. useComputed ───────────────────────────────────────────────────

function ComputedSection(): Rendered {
  const { rc, rendered } = useReactive();
  const first = useControl("Ada");
  const last = useControl("Lovelace");
  const fullName = useComputed((rc) =>
    [rc.getValue(first), rc.getValue(last)].filter(Boolean).join(" "),
  );
  return rendered(
    <Section
      title="2. useComputed"
      note="A Control derived from other controls; the compute reads through its own rc and re-runs when its dependencies change."
    >
      <Labeled label="First">
        <ControlInput className={inputClass} control={first} />
      </Labeled>
      <Labeled label="Last">
        <ControlInput className={inputClass} control={last} />
      </Labeled>
      <div className="text-sm text-zinc-700">
        Full name: <strong>{rc.getValue(fullName) || "(empty)"}</strong>
      </div>
    </Section>,
  );
}

// ── 3. useControlEffect (+ composed debounce) ────────────────────────

function EffectsSection(): Rendered {
  const { rendered, update } = useReactive();
  const watched = useControl("");
  const debounced = useControl("");
  const log = useControl<string[]>([]);

  useControlEffect(
    (rc) => rc.getValue(watched),
    (v) =>
      update((wc) => wc.addElement(log, `useControlEffect: watched → "${v}"`)),
  );

  // @rxc/controls has no useValueChangeEffect — the debounce composes from
  // useControlEffect + a timer, which is all the legacy hook was.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useControlEffect(
    (rc) => rc.getValue(debounced),
    (v) => {
      if (timer.current != null) clearTimeout(timer.current);
      timer.current = setTimeout(
        () =>
          update((wc) =>
            wc.addElement(log, `composed debounce (500ms): debounced → "${v}"`),
          ),
        500,
      );
    },
  );

  return rendered(
    <Section
      title="3. useControlEffect + useValueChangeEffect"
      note="Side effects on value change — immediate (computed watch) and debounced. No useValueChangeEffect here: the 500ms debounce is composed from useControlEffect."
    >
      <Labeled label="Watched">
        <ControlInput className={inputClass} control={watched} />
      </Labeled>
      <Labeled label="Debounced">
        <ControlInput className={inputClass} control={debounced} />
      </Labeled>
      <div className="flex items-start gap-2">
        <ul className="max-h-32 min-h-8 grow overflow-y-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700">
          <RenderElements control={log} empty={<li>(no changes yet)</li>}>
            {(rc, entry) => <li>{rc.getValue(entry)}</li>}
          </RenderElements>
        </ul>
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.setValue(log, []))}
        >
          Clear
        </button>
      </div>
    </Section>,
  );
}

// ── 4. useValidator + useAsyncValidator ──────────────────────────────

function ValidatorsSection(): Rendered {
  const { rc, rendered } = useReactive();
  const password = useControl("");
  const confirm = useControl("");
  const username = useControl("");

  useValidator(confirm, (v, rc) =>
    v === rc.getValue(password) ? null : "Passwords must match",
  );
  useAsyncValidator(
    username,
    async (c, signal) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 400);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      const taken = ["admin", "root"].includes(
        c.valueNow.trim().toLowerCase(),
      );
      return taken ? "Username is taken" : null;
    },
    500,
  );

  return rendered(
    <Section
      title="4. useValidator + useAsyncValidator"
      note='Dynamic cross-field validator (the validator reads password through its own rc) and a debounced async check ("admin" / "root" are taken).'
    >
      <Labeled label="Password">
        <ControlInput className={inputClass} type="password" control={password} />
      </Labeled>
      <Labeled label="Confirm">
        <ControlInput className={inputClass} type="password" control={confirm} />
        {rc.isTouched(confirm) && rc.getError(confirm) && (
          <span className="text-xs text-red-600">{rc.getError(confirm)}</span>
        )}
      </Labeled>
      <Labeled label="Username">
        <ControlInput className={inputClass} control={username} />
        {rc.getError(username) && (
          <span className="text-xs text-red-600">{rc.getError(username)}</span>
        )}
      </Labeled>
    </Section>,
  );
}

// ── 5. useControlGroup (+ computed pair, no controlValues) ───────────

function GroupSection(): Rendered {
  const { rc, rendered } = useReactive();
  const city = useControl("Hobart");
  const postcode = useControl("", {
    validator: (v) => (v ? undefined : "Required"),
  });
  const address = useControlGroup({ city, postcode });
  // Legacy pairs controls with controlValues(); here a computed simply reads
  // both through its rc.
  const pair = useComputed((rc) => [rc.getValue(city), rc.getValue(postcode)]);

  return rendered(
    <Section
      title="5. useControlGroup + controlValues"
      note="Two standalone controls attached into one group control — value and validity aggregate. No controlValues helper: the computed reads both controls through its rc."
    >
      <Labeled label="City">
        <ControlInput className={inputClass} control={city} />
      </Labeled>
      <Labeled label="Postcode *">
        <ControlInput className={inputClass} control={postcode} />
      </Labeled>
      <div className="text-sm text-zinc-700">
        Group value:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(rc.getValue(address))}
        </code>
      </div>
      <div className="text-sm text-zinc-700">
        Computed tuple:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(rc.getValue(pair))}
        </code>
      </div>
      <StateChips dirty={rc.isDirty(address)} valid={rc.isValid(address)} />
    </Section>,
  );
}

// ── 6. useValueWithPrevious ──────────────────────────────────────────────

function PreviousValueSection(): Rendered {
  const { rc, rendered, update } = useReactive();
  const price = useControl(10);
  const withPrev = useValueWithPrevious(price);
  const { previous, current } = rc.getValue(withPrev);

  return rendered(
    <Section
      title="6. useValueWithPrevious"
      note="A control holding the current value alongside the value it had before the last change."
    >
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.updateValue(price, (v) => v - 1))}
        >
          −1
        </button>
        <span className="w-12 text-center text-sm text-zinc-900">
          {rc.getValue(price)}
        </span>
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.updateValue(price, (v) => v + 1))}
        >
          +1
        </button>
      </div>
      <div className="text-sm text-zinc-700">
        previous: <strong>{previous ?? "(none)"}</strong> — current:{" "}
        <strong>{current}</strong>
      </div>
    </Section>,
  );
}

// ── 7. useSelectableArray + selectableValues ───────────────────

const ALL_TAGS = ["red", "green", "blue", "yellow"];

function SelectableSection(): Rendered {
  const { rc, rendered } = useReactive();
  const tags = useControl<string[]>(["green"]);
  const selectable = useSelectableArray(
    tags,
    selectableValues(ALL_TAGS, (x) => x),
  );

  return rendered(
    <Section
      title="7. useSelectableArray + selectableValues"
      note="A string[] control exposed as {selected, value} checkbox rows; toggling rewrites the underlying array."
    >
      <div className="flex gap-4">
        <RenderElements control={selectable}>
          {(rc, entry) => (
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <ControlCheckbox control={entry.fields.selected} />
              {rc.getValue(entry.fields.value)}
            </label>
          )}
        </RenderElements>
      </div>
      <div className="text-sm text-zinc-700">
        Array value:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(rc.getValue(tags))}
        </code>
      </div>
    </Section>,
  );
}

// ── 8. ControlSelect + ControlCheckbox (checkbox / notValue / radio) ─────────────

function BoundComponentsSection(): Rendered {
  const { rc, rendered } = useReactive();
  const flavour = useControl<string | undefined>("vanilla");
  const subscribe = useControl<boolean | undefined>(false);
  const optOut = useControl<boolean | undefined>(false);
  const approved = useControl<boolean | undefined>(false);

  return rendered(
    <Section
      title="8. ControlSelect + ControlCheckbox"
      note="Select binding, plain checkbox, notValue-inverted checkbox, and a boolean radio pair (radio + notValue radio)."
    >
      <Labeled label="Flavour">
        <ControlSelect className={inputClass} control={flavour}>
          <option value="vanilla">Vanilla</option>
          <option value="chocolate">Chocolate</option>
          <option value="strawberry">Strawberry</option>
        </ControlSelect>
        <span className="text-xs text-zinc-500">→ {rc.getValue(flavour)}</span>
      </Labeled>
      <Labeled label="Subscribe">
        <ControlCheckbox control={subscribe} />
        <span className="text-xs text-zinc-500">
          → {String(rc.getValue(subscribe))}
        </span>
      </Labeled>
      <Labeled label="Opt out (notValue)">
        <ControlCheckbox control={optOut} notValue />
        <span className="text-xs text-zinc-500">
          checked writes false → {String(rc.getValue(optOut))}
        </span>
      </Labeled>
      <Labeled label="Approved?">
        <span className="flex items-center gap-1 text-sm">
          <ControlCheckbox type="radio" control={approved} /> yes
        </span>
        <span className="flex items-center gap-1 text-sm">
          <ControlCheckbox type="radio" control={approved} notValue /> no
        </span>
        <span className="text-xs text-zinc-500">
          → {String(rc.getValue(approved))}
        </span>
      </Labeled>
    </Section>,
  );
}

// ── 9. useFormControlProps ───────────────────────────────────────────

function FormControlPropsSection(): Rendered {
  const { rc, rendered } = useReactive();
  const nickname = useControl("", {
    validator: (v) => (v ? undefined : "Required"),
  });
  const { errorText, ...props } = useFormControlProps<string, HTMLInputElement>(
    rc,
    nickname,
  );

  return rendered(
    <Section
      title="9. formControlProps"
      note="Manual binding of a control to a hand-rolled input — legacy useFormControlProps(state) becomes useFormControlProps(rc, control); the FormEditState fold is the same on both sides."
    >
      <Labeled label="Nickname *">
        <input
          {...props}
          className={`${inputClass} ${errorText ? "border-red-500" : ""}`}
        />
        {errorText && <span className="text-xs text-red-600">{errorText}</span>}
      </Labeled>
    </Section>,
  );
}

// ── 10. Render helpers + array ops ───────────────────────────────────

interface Person {
  name: string;
  role: string;
}

// Deliberately NOT a useReactive component: its body makes no reactive reads.
// The render helpers open their own subscription scopes, and the button
// handlers read snapshots via valueNow — so the section itself never
// re-renders.
function RenderHelpersSection() {
  const { update } = useControlContext();
  const people = useControl<Person[]>([
    { name: "Alice", role: "Engineer" },
    { name: "Bob", role: "Designer" },
  ]);
  const optional = useControl<string | undefined>(undefined);
  const user = useControl<string | undefined>(undefined);
  const account = useControl<number | undefined>(undefined);

  return (
    <Section
      title="10. Render helpers + array ops"
      note="RenderElements (wc.addElement / removeElement / updateElements), RenderOptional, Reactive + whenAllDefined, RenderArrayElements. This section component makes no reactive reads itself — each helper is its own subscription scope."
    >
      <h3 className="text-sm font-semibold text-zinc-800">
        RenderElements — people
      </h3>
      <RenderElements
        control={people}
        empty={<i className="text-sm text-zinc-500">No people</i>}
        container={(children) => (
          <div className="flex flex-col divide-y divide-zinc-100">
            {children}
          </div>
        )}
      >
        {(rc, person, i, total) => (
          <div className="flex items-center gap-2 py-2">
            <span className="w-10 text-xs text-zinc-400">
              {i + 1}/{total}
            </span>
            <ControlInput className={inputClass} control={person.fields.name} />
            <ControlInput className={inputClass} control={person.fields.role} />
            <button
              className={buttonClass}
              onClick={() => update((wc) => wc.removeElement(people, person))}
            >
              Remove
            </button>
          </div>
        )}
      </RenderElements>
      <div className="flex gap-2">
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) => wc.addElement(people, { name: "", role: "" }))
          }
        >
          Add (addElement)
        </button>
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) =>
              wc.updateElements(people, (elems) => [...elems].reverse()),
            )
          }
        >
          Reverse (updateElements)
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-zinc-800">
        RenderOptional — nullable control
      </h3>
      <div className="flex items-center gap-2">
        <RenderOptional
          control={optional}
          notDefined={<i className="text-sm text-zinc-500">Not set</i>}
        >
          {(rc, c) => <ControlInput className={inputClass} control={c} />}
        </RenderOptional>
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.setValue(optional, "hello"))}
        >
          Set
        </button>
        <button
          className={buttonClass}
          onClick={() => update((wc) => wc.setValue(optional, undefined))}
        >
          Clear
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-zinc-800">
        Reactive + whenAllDefined — waits for both
      </h3>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-700">
          <Reactive>
            {whenAllDefined(
              { user, account },
              ({ user, account }) => (
                <span>
                  {user} / #{account}
                </span>
              ),
              <i className="text-zinc-500">waiting for both…</i>,
            )}
          </Reactive>
        </span>
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) =>
              wc.setValue(user, user.valueNow ? undefined : "ada"),
            )
          }
        >
          Toggle user
        </button>
        <button
          className={buttonClass}
          onClick={() =>
            update((wc) =>
              wc.setValue(account, account.valueNow ? undefined : 42),
            )
          }
        >
          Toggle account
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-zinc-800">
        RenderArrayElements — plain array
      </h3>
      <div className="flex gap-2">
        <RenderArrayElements array={["one", "two", "three"]}>
          {(v, i) => (
            <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
              {i}: {v}
            </span>
          )}
        </RenderArrayElements>
      </div>
    </Section>
  );
}

// ── 11. FormEditProvider ─────────────────────────────────────────────

function FormEditSection(): Rendered {
  const { rc, rendered } = useReactive();
  const lockReadonly = useControl<boolean | undefined>(false);
  const lockDisabled = useControl<boolean | undefined>(false);
  const name = useControl("Grace");
  const level = useControl<string | undefined>("two");
  const active = useControl<boolean | undefined>(true);

  return rendered(
    <Section
      title="11. FormEditProvider"
      note="A cascading, restriction-only edit lock: readonly / disabled apply to every F-component in the subtree without touching control state. Same shape as legacy core 4.6+."
    >
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <ControlCheckbox control={lockReadonly} /> readonly
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <ControlCheckbox control={lockDisabled} /> disabled
        </label>
      </div>
      <FormEditProvider
        readonly={rc.getValue(lockReadonly)}
        disabled={rc.getValue(lockDisabled)}
      >
        <div className="flex items-center gap-3 rounded border border-dashed border-zinc-300 p-3">
          <ControlInput className={inputClass} control={name} />
          <ControlSelect className={inputClass} control={level}>
            <option value="one">One</option>
            <option value="two">Two</option>
          </ControlSelect>
          <ControlCheckbox control={active} />
        </div>
      </FormEditProvider>
    </Section>,
  );
}

// ── Page ─────────────────────────────────────────────────────────────

const controlContext = createControlContext();

export default function Page() {
  return (
    <ControlContextProvider value={controlContext}>
      <div className="min-h-screen bg-zinc-50 p-6 font-sans">
        <main className="mx-auto flex max-w-3xl flex-col gap-6">
          <header className="rounded-lg bg-white p-6 shadow">
            <h1 className="text-2xl font-bold text-zinc-900">
              @rxc/controls kitchen sink
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              The legacy <code>@react-typed-forms/core</code> demo ported to
              explicit-reactivity <code>@rxc/controls</code>. Pair with{" "}
              <a
                className="text-blue-600 hover:underline"
                href="http://localhost:3001/controls"
              >
                localhost:3001/controls
              </a>{" "}
              in the legacy-demos app.
            </p>
          </header>
          <BasicFormSection />
          <ComputedSection />
          <EffectsSection />
          <ValidatorsSection />
          <GroupSection />
          <PreviousValueSection />
          <SelectableSection />
          <BoundComponentsSection />
          <FormControlPropsSection />
          <RenderHelpersSection />
          <FormEditSection />
        </main>
      </div>
    </ControlContextProvider>
  );
}
