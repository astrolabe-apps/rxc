"use client";

/**
 * Kitchen-sink demo of the @react-typed-forms/core surface (hooks +
 * components), rendered with the published legacy package. Pair with
 * localhost:3000/controls in the dev app, which mirrors this page
 * section-for-section via @rx-controls/react.
 *
 * Reactivity here is ambient: the @astroapps/swc-controls-plugin wraps every
 * component so plain `.value` reads subscribe automatically.
 */

import { ReactNode, useState } from "react";
import {
  Fcheckbox,
  Finput,
  FormEditProvider,
  Fselect,
  RenderArrayElements,
  RenderControl,
  RenderElements,
  RenderOptional,
  addElement,
  controlValues,
  ensureSelectableValues,
  groupedChanges,
  notEmpty,
  removeElement,
  renderOptionally,
  updateElements,
  useAsyncValidator,
  useComputed,
  useControl,
  useControlEffect,
  useControlGroup,
  useFormControlProps,
  usePreviousValue,
  useSelectableArray,
  useValidator,
  useValueChangeEffect,
} from "@react-typed-forms/core";

// ── Shared chrome ────────────────────────────────────────────────────

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

// ── 1. useControl + Finput + setup validators ────────────────────────

interface BasicForm {
  firstName: string;
  lastName: string;
  email: string;
}

function BasicFormSection() {
  const form = useControl<BasicForm>(
    { firstName: "", lastName: "", email: "" },
    {
      fields: {
        lastName: { validator: notEmpty("Required field") },
        email: {
          validator: (v) => (v.includes("@") ? undefined : "Must contain @"),
        },
      },
    },
  );
  const fields = form.fields;
  const [submitted, setSubmitted] = useState<BasicForm>();

  return (
    <Section
      title="1. useControl + Finput + setup validators"
      note="ControlSetup field validators (notEmpty + custom), dirty/valid/touched flags, validate(), markAsClean(), reset to initial value."
    >
      <Labeled label="First name">
        <Finput className={inputClass} control={fields.firstName} />
      </Labeled>
      <Labeled label="Last name *">
        <Finput className={inputClass} control={fields.lastName} />
        {fields.lastName.touched && fields.lastName.error && (
          <span className="text-xs text-red-600">{fields.lastName.error}</span>
        )}
      </Labeled>
      <Labeled label="Email *">
        <Finput className={inputClass} type="email" control={fields.email} />
        {fields.email.touched && fields.email.error && (
          <span className="text-xs text-red-600">{fields.email.error}</span>
        )}
      </Labeled>
      <StateChips dirty={form.dirty} valid={form.valid} touched={form.touched} />
      <div className="flex gap-2">
        <button
          className={buttonClass}
          onClick={() => {
            form.touched = true;
            if (form.validate()) {
              setSubmitted(form.value);
              form.markAsClean();
            }
          }}
        >
          Submit
        </button>
        <button
          className={buttonClass}
          onClick={() => {
            form.value = form.initialValue;
            form.touched = false;
          }}
        >
          Reset
        </button>
        <button
          className={buttonClass}
          onClick={() =>
            groupedChanges(() => {
              fields.firstName.value = "Jane";
              fields.lastName.value = "Doe";
              fields.email.value = "jane@doe.example";
            })
          }
        >
          Fill sample (groupedChanges)
        </button>
        <button
          className={buttonClass}
          onClick={() => (form.disabled = !form.current.disabled)}
        >
          Toggle disabled
        </button>
      </div>
      {submitted && (
        <pre className="rounded bg-zinc-100 p-2 text-xs text-zinc-800">
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </Section>
  );
}

// ── 2. useComputed ───────────────────────────────────────────────────

function ComputedSection() {
  const first = useControl("Ada");
  const last = useControl("Lovelace");
  const fullName = useComputed(() =>
    [first.value, last.value].filter(Boolean).join(" "),
  );
  return (
    <Section
      title="2. useComputed"
      note="A Control derived from other controls; recomputes when its dependencies change."
    >
      <Labeled label="First">
        <Finput className={inputClass} control={first} />
      </Labeled>
      <Labeled label="Last">
        <Finput className={inputClass} control={last} />
      </Labeled>
      <div className="text-sm text-zinc-700">
        Full name: <strong>{fullName.value || "(empty)"}</strong>
      </div>
    </Section>
  );
}

// ── 3. useControlEffect + useValueChangeEffect ───────────────────────

function EffectsSection() {
  const watched = useControl("");
  const debounced = useControl("");
  const log = useControl<string[]>([]);

  useControlEffect(
    () => watched.value,
    (v) => addElement(log, `useControlEffect: watched → "${v}"`),
  );
  useValueChangeEffect(
    debounced,
    (v) => addElement(log, `useValueChangeEffect (500ms): debounced → "${v}"`),
    500,
  );

  return (
    <Section
      title="3. useControlEffect + useValueChangeEffect"
      note="Side effects on value change — immediate (computed watch) and debounced (500ms). Both append to the log below."
    >
      <Labeled label="Watched">
        <Finput className={inputClass} control={watched} />
      </Labeled>
      <Labeled label="Debounced">
        <Finput className={inputClass} control={debounced} />
      </Labeled>
      <div className="flex items-start gap-2">
        <ul className="max-h-32 min-h-8 grow overflow-y-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700">
          <RenderElements control={log} empty={<li>(no changes yet)</li>}>
            {(entry) => <li>{entry.value}</li>}
          </RenderElements>
        </ul>
        <button className={buttonClass} onClick={() => (log.value = [])}>
          Clear
        </button>
      </div>
    </Section>
  );
}

// ── 4. useValidator + useAsyncValidator ──────────────────────────────

function ValidatorsSection() {
  const password = useControl("");
  const confirm = useControl("");
  const username = useControl("");

  useValidator(confirm, (v) =>
    v === password.value ? null : "Passwords must match",
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
      const taken = ["admin", "root"].includes(c.value.trim().toLowerCase());
      return taken ? "Username is taken" : null;
    },
    500,
  );

  return (
    <Section
      title="4. useValidator + useAsyncValidator"
      note='Dynamic cross-field validator (confirm must match password) and a debounced async check ("admin" / "root" are taken).'
    >
      <Labeled label="Password">
        <Finput className={inputClass} type="password" control={password} />
      </Labeled>
      <Labeled label="Confirm">
        <Finput className={inputClass} type="password" control={confirm} />
        {confirm.touched && confirm.error && (
          <span className="text-xs text-red-600">{confirm.error}</span>
        )}
      </Labeled>
      <Labeled label="Username">
        <Finput className={inputClass} control={username} />
        {username.error && (
          <span className="text-xs text-red-600">{username.error}</span>
        )}
      </Labeled>
    </Section>
  );
}

// ── 5. useControlGroup + controlValues ───────────────────────────────

function GroupSection() {
  const city = useControl("Hobart");
  const postcode = useControl("", { validator: notEmpty("Required") });
  const address = useControlGroup({ city, postcode });
  const pair = useComputed(controlValues(city, postcode));

  return (
    <Section
      title="5. useControlGroup + controlValues"
      note="Two standalone controls attached into one group control — value and validity aggregate. controlValues() tuples them for a computed."
    >
      <Labeled label="City">
        <Finput className={inputClass} control={city} />
      </Labeled>
      <Labeled label="Postcode *">
        <Finput className={inputClass} control={postcode} />
      </Labeled>
      <div className="text-sm text-zinc-700">
        Group value:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(address.value)}
        </code>
      </div>
      <div className="text-sm text-zinc-700">
        controlValues tuple:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(pair.value)}
        </code>
      </div>
      <StateChips dirty={address.dirty} valid={address.valid} />
    </Section>
  );
}

// ── 6. usePreviousValue ──────────────────────────────────────────────

function PreviousValueSection() {
  const price = useControl(10);
  const withPrev = usePreviousValue(price);
  const { previous, current } = withPrev.value;

  return (
    <Section
      title="6. usePreviousValue"
      note="A control holding the current value alongside the value it had before the last change."
    >
      <div className="flex items-center gap-2">
        <button
          className={buttonClass}
          onClick={() => (price.value = price.current.value - 1)}
        >
          −1
        </button>
        <span className="w-12 text-center text-sm text-zinc-900">
          {price.value}
        </span>
        <button
          className={buttonClass}
          onClick={() => (price.value = price.current.value + 1)}
        >
          +1
        </button>
      </div>
      <div className="text-sm text-zinc-700">
        previous: <strong>{previous ?? "(none)"}</strong> — current:{" "}
        <strong>{current}</strong>
      </div>
    </Section>
  );
}

// ── 7. useSelectableArray + ensureSelectableValues ───────────────────

const ALL_TAGS = ["red", "green", "blue", "yellow"];

function SelectableSection() {
  const tags = useControl<string[]>(["green"]);
  const selectable = useSelectableArray(
    tags,
    ensureSelectableValues(ALL_TAGS, (x) => x),
  );

  return (
    <Section
      title="7. useSelectableArray + ensureSelectableValues"
      note="A string[] control exposed as {selected, value} checkbox rows; toggling rewrites the underlying array."
    >
      <div className="flex gap-4">
        <RenderElements control={selectable}>
          {(entry) => (
            <label className="flex items-center gap-1.5 text-sm text-zinc-700">
              <Fcheckbox control={entry.fields.selected} />
              {entry.fields.value.value}
            </label>
          )}
        </RenderElements>
      </div>
      <div className="text-sm text-zinc-700">
        Array value:{" "}
        <code className="rounded bg-zinc-100 px-1">
          {JSON.stringify(tags.value)}
        </code>
      </div>
    </Section>
  );
}

// ── 8. Fselect + Fcheckbox (checkbox / notValue / radio) ─────────────

function BoundComponentsSection() {
  const flavour = useControl("vanilla");
  const subscribe = useControl(false);
  const optOut = useControl(false);
  const approved = useControl(false);

  return (
    <Section
      title="8. Fselect + Fcheckbox"
      note="Select binding, plain checkbox, notValue-inverted checkbox, and a boolean radio pair (radio + notValue radio)."
    >
      <Labeled label="Flavour">
        <Fselect className={inputClass} control={flavour}>
          <option value="vanilla">Vanilla</option>
          <option value="chocolate">Chocolate</option>
          <option value="strawberry">Strawberry</option>
        </Fselect>
        <span className="text-xs text-zinc-500">→ {flavour.value}</span>
      </Labeled>
      <Labeled label="Subscribe">
        <Fcheckbox control={subscribe} />
        <span className="text-xs text-zinc-500">
          → {String(subscribe.value)}
        </span>
      </Labeled>
      <Labeled label="Opt out (notValue)">
        <Fcheckbox control={optOut} notValue />
        <span className="text-xs text-zinc-500">
          checked writes false → {String(optOut.value)}
        </span>
      </Labeled>
      <Labeled label="Approved?">
        <span className="flex items-center gap-1 text-sm">
          <Fcheckbox type="radio" control={approved} /> yes
        </span>
        <span className="flex items-center gap-1 text-sm">
          <Fcheckbox type="radio" control={approved} notValue /> no
        </span>
        <span className="text-xs text-zinc-500">→ {String(approved.value)}</span>
      </Labeled>
    </Section>
  );
}

// ── 9. formControlProps ──────────────────────────────────────────────

function FormControlPropsSection() {
  const nickname = useControl("", { validator: notEmpty("Required") });
  const { errorText, ...props } = useFormControlProps<string, HTMLInputElement>(
    nickname,
  );

  return (
    <Section
      title="9. formControlProps"
      note="Manual binding of a control to a hand-rolled input — value/onChange/onBlur/disabled/ref props plus errorText. useFormControlProps also folds in the ambient FormEditState; formControlProps is the context-free variant."
    >
      <Labeled label="Nickname *">
        <input
          {...props}
          className={`${inputClass} ${errorText ? "border-red-500" : ""}`}
        />
        {errorText && <span className="text-xs text-red-600">{errorText}</span>}
      </Labeled>
    </Section>
  );
}

// ── 10. Render helpers + array ops ───────────────────────────────────

interface Person {
  name: string;
  role: string;
}

function RenderHelpersSection() {
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
      note="RenderElements (addElement / removeElement / updateElements), RenderOptional, RenderControl + renderOptionally, RenderArrayElements."
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
        {(person, i, total) => (
          <div className="flex items-center gap-2 py-2">
            <span className="w-10 text-xs text-zinc-400">
              {i + 1}/{total}
            </span>
            <Finput className={inputClass} control={person.fields.name} />
            <Finput className={inputClass} control={person.fields.role} />
            <button
              className={buttonClass}
              onClick={() => removeElement(people, person)}
            >
              Remove
            </button>
          </div>
        )}
      </RenderElements>
      <div className="flex gap-2">
        <button
          className={buttonClass}
          onClick={() => addElement(people, { name: "", role: "" })}
        >
          Add (addElement)
        </button>
        <button
          className={buttonClass}
          onClick={() => updateElements(people, (elems) => [...elems].reverse())}
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
          {(c) => <Finput className={inputClass} control={c} />}
        </RenderOptional>
        <button className={buttonClass} onClick={() => (optional.value = "hello")}>
          Set
        </button>
        <button className={buttonClass} onClick={() => (optional.value = undefined)}>
          Clear
        </button>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-zinc-800">
        RenderControl + renderOptionally — waits for both
      </h3>
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-700">
          <RenderControl>
            {renderOptionally(
              { user, account },
              ({ user, account }) => (
                <span>
                  {user} / #{account}
                </span>
              ),
              <i className="text-zinc-500">waiting for both…</i>,
            )}
          </RenderControl>
        </span>
        <button
          className={buttonClass}
          onClick={() => (user.value = user.value ? undefined : "ada")}
        >
          Toggle user
        </button>
        <button
          className={buttonClass}
          onClick={() => (account.value = account.value ? undefined : 42)}
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

function FormEditSection() {
  const lockReadonly = useControl(false);
  const lockDisabled = useControl(false);
  const name = useControl("Grace");
  const level = useControl<string | number | undefined>("two");
  const active = useControl(true);

  return (
    <Section
      title="11. FormEditProvider"
      note="A cascading, restriction-only edit lock (core 4.6+): readonly / disabled apply to every F-component in the subtree without touching control state."
    >
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <Fcheckbox control={lockReadonly} /> readonly
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <Fcheckbox control={lockDisabled} /> disabled
        </label>
      </div>
      <FormEditProvider
        readonly={lockReadonly.value}
        disabled={lockDisabled.value}
      >
        <div className="flex items-center gap-3 rounded border border-dashed border-zinc-300 p-3">
          <Finput className={inputClass} control={name} />
          <Fselect className={inputClass} control={level}>
            <option value="one">One</option>
            <option value="two">Two</option>
          </Fselect>
          <Fcheckbox control={active} />
        </div>
      </FormEditProvider>
    </Section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function ControlsKitchenSink() {
  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      <main className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="rounded-lg bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-zinc-900">
            @react-typed-forms/core kitchen sink (legacy)
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Every hook and component of the legacy core library on one page.
            Pair with{" "}
            <a
              className="text-blue-600 hover:underline"
              href="http://localhost:3000/controls"
            >
              localhost:3000/controls
            </a>{" "}
            — the same page ported to <code>@rx-controls/react</code>.
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
  );
}
