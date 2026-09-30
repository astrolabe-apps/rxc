/**
 * The HVAMS gate for Forms v2, in-repo: a v2 form mounted inside a
 * compat-engine app. The app is a legacy `@react-typed-forms/core` app —
 * ambient `.value` reads, legacy mutators, `Finput` — migrated the way
 * `packages/compat-controls/README.md` describes, with one root provider. The
 * v2 form is dropped into it and bound to the app's own compat controls,
 * passed straight to v2 bindings with no cast.
 *
 * What it has to show, and what `test/compatFixture.test.tsx` asserts:
 *
 *  - **one engine copy** — the compat package and the v2 packages resolve the
 *    same `@rx-controls/core`, so the prototype patch covers the controls v2
 *    creates as well as the app's;
 *  - **both directions** — a write through either surface reaches the other
 *    at once: v2 typing re-renders the legacy panel, and a legacy mutation,
 *    `Finput` or array op re-renders the v2 form;
 *  - **no ambient-read staleness** — v2 reads only through its `rc`, so it
 *    never depends on a collector being installed. The test runs under
 *    `setStrictAmbient("throw")`, which makes any uncollected ambient read, or
 *    any read through a finalized `rc`, throw instead of going stale.
 *
 * The dev app runs no SWC tracking plugin, so `tracked()` stands in for it
 * with exactly what the plugin injects — as `/compat` does.
 */

import { type FC, type ReactNode } from "react";
import {
  addElement,
  ControlContextProvider,
  Finput,
  getCompatContext,
  useComponentTracking,
  useControl,
  type Control,
} from "@react-typed-forms/core";
import { useControlContext, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  arrayActions,
  Elements,
  Form,
  FormProvider,
  SelectField,
  StandardActionIds,
  TextField,
  useFormValidation,
} from "@rx-controls/forms-react";
import {
  htmlRenderers,
  HtmlThemeProvider,
  tailwindHtmlTheme,
} from "@rx-controls/forms-html";

function tracked<P extends object>(f: FC<P>): FC<P> {
  const Tracked: FC<P> = (props) => {
    const stop = useComponentTracking();
    try {
      return f(props);
    } finally {
      stop();
    }
  };
  Tracked.displayName = f.name || "Tracked";
  return Tracked;
}

export interface Member {
  name: string;
  status: string | undefined;
  pets: { name: string }[];
}

const statusOptions = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
];

const button =
  "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50";

/**
 * The app root. The provider gets a component of its own: hooks in the
 * component that renders it run outside it — and under the SWC plugin this
 * one would be `@noTrackControls`, since the plugin's tracking hook would
 * run above the provider too.
 */
export function CompatApp({ children }: { children?: ReactNode }) {
  return (
    <ControlContextProvider value={getCompatContext()}>
      <HtmlThemeProvider theme={tailwindHtmlTheme}>
        <FormProvider renderers={htmlRenderers}>
          {children ?? <CompatFixture />}
        </FormProvider>
      </HtmlThemeProvider>
    </ControlContextProvider>
  );
}

/** A legacy component that owns the data — a compat `useControl`. */
export const CompatFixture = tracked(function CompatFixture() {
  const member = useControl<Member>({
    name: "",
    status: undefined,
    pets: [{ name: "Rex" }],
  });
  return (
    <div className="grid grid-cols-2 gap-6">
      <section data-legacy className="flex flex-col gap-3">
        <h2 className="font-semibold">Legacy — ambient reads</h2>
        <LegacyPanel member={member} />
      </section>
      <section data-v2 className="flex flex-col gap-3">
        <h2 className="font-semibold">Forms v2 — the same controls</h2>
        <V2Member member={member} />
      </section>
    </div>
  );
});

/**
 * Legacy code as it already exists in the app: `.value` and `.error` read
 * ambiently, writes through the legacy mutators.
 */
const LegacyPanel = tracked(function LegacyPanel({
  member,
}: {
  member: Control<Member>;
}) {
  const f = member.fields;
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt>name</dt>
        <dd data-legacy-name>{f.name.value}</dd>
        <dt>name error</dt>
        <dd data-legacy-name-error>{f.name.error ?? "—"}</dd>
        <dt>status</dt>
        <dd data-legacy-status>{f.status.value ?? "—"}</dd>
        <dt>pets</dt>
        <dd data-legacy-pets>{f.pets.elements.length}</dd>
      </dl>
      <label className="flex flex-col gap-1 text-sm">
        Name (legacy Finput)
        <Finput
          control={f.name}
          data-legacy-input
          className="rounded border border-zinc-300 px-3 py-1.5"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          data-legacy-set-status
          className={button}
          onClick={() => (f.status.value = "inactive")}
        >
          Status → inactive
        </button>
        <button
          type="button"
          data-legacy-add-pet
          className={button}
          onClick={() => addElement(f.pets, { name: "Tiddles" })}
        >
          Add pet
        </button>
      </div>
    </>
  );
});

/**
 * The v2 form, written the way a converted component is: `useReactive`, and
 * the app's compat controls handed straight to v2 bindings.
 */
function V2Member({ member }: { member: Control<Member> }): Rendered {
  const { rc, rendered } = useReactive();
  const ctx = useControlContext();
  const validation = useFormValidation();
  const f = member.fields;
  const pets = arrayActions(rc, ctx, f.pets, { maxLength: 3 });
  return rendered(
    <>
      <Form validation={validation}>
        <TextField field={f.name} label="Name" required id="v2-name" />
        <SelectField
          field={f.status}
          label="Status"
          options={statusOptions}
          id="v2-status"
        />
        <Elements field={f.pets} label="Pets" maxLength={3}>
          {(pet, i) => (
            <TextField field={pet.fields.name} label={`Pet ${i + 1}`} />
          )}
        </Elements>
        <div className="flex gap-2">
          <Action
            actionId={StandardActionIds.add}
            text="Add pet (v2)"
            disabled={!pets.canAdd}
            onClick={() => pets.add({ name: "" })}
          />
          <Action
            actionId="check"
            text="Check form"
            variant="primary"
            onClick={() => validation.check().then(() => {})}
          />
        </div>
      </Form>
      <p data-v2-status className="text-sm">
        v2 form: {validation.isValid(rc) ? "valid" : "invalid"}
      </p>
    </>,
  );
}
