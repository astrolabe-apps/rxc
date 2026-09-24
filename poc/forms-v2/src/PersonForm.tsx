import { useMemo, type ReactNode } from "react";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import type { Control } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import {
  arrayActions,
  Action,
  CheckboxField,
  Dialog,
  Section,
  SelectField,
  TextDisplay,
  Wizard,
  Contents,
  Elements,
  IconDisplay,
  InlineGroup,
  DisplayOnlyField,
  RadioField,
  getExternalEdit,
  StandardActionIds,
  Tabs,
  Form,
  FormScopeProvider,
  narrowScope,
  TextField,
  useFormScope,
  useStack,
  type Presence,
} from "./framework/index.js";
import { Stars } from "./widgets/Stars.js";
import { PetCards } from "./widgets/PetCards.js";
import { Collapsible } from "./widgets/Collapsible.js";
import { SelectChild } from "./widgets/SelectChild.js";
import { JsonForm } from "./loader/JsonForm.js";
import { demoControls, demoSchema } from "./loader/demoForm.js";
import { AntInputReference } from "./impls/antd.js";

export interface Person {
  firstName: string;
  lastName: string;
  email: string;
  notes: string;
  rating: number | undefined;
  hasPets: boolean;
  pets: { name: string }[];
  vetName: string;
  status: string | undefined;
  priority: number | undefined;
  /** A compound, so the JSON tab can bind `address/city` and climb out with `../firstName`. */
  address: { street: string; city: string };
  /** A date, so DisplayOnly has something to format. */
  joined: string | undefined;
  /** The wizard's page index, kept in the data rather than in a component. */
  wizardPage: number | undefined;
}

/** One place, so the buttons and the array's `Length` validator agree. */
const petBounds = { minLength: 1, maxLength: 3 };

/** For the demo's state table only — the form itself needs no schema. */
export const statusOptions = [
  { name: "Active", value: "active" },
  { name: "Inactive", value: "inactive" },
  { name: "Pending", value: "pending", disabled: true },
];

export const personFieldNames: (keyof Person)[] = [
  "firstName",
  "lastName",
  "email",
  "notes",
  "rating",
  "hasPets",
  "pets",
  "vetName",
  "status",
  "priority",
  "address",
  "joined",
  "wizardPage",
];

/**
 * A container implementation — the only kind of thing that narrows presence to
 * `silent`. A real one would be a tab panel or a wizard page; no form author
 * ever writes `silent`, which is why it is a scope facet and not a prop.
 */
function Panel({
  presence,
  children,
}: {
  presence: Presence;
  children: ReactNode;
}) {
  const parent = useFormScope();
  const scope = useMemo(
    () => narrowScope(parent, { presence }),
    [parent, presence],
  );
  return <FormScopeProvider scope={scope}>{children}</FormScopeProvider>;
}

type Pets = { name: string }[];

/**
 * The staged-edit host. Rendered **outside** the region the array lives in,
 * and it reads the scope at its own position like any other component — the
 * draft is not bound to the array's region. If the region the edit began in
 * locks or hides while a session is open, the controller cancels the session
 * and this closes (README finding 19).
 */
function DraftHost({ field }: { field: Control<Pets> }) {
  const { rc, rendered } = useReactive();
  const ctx = useControlContext();
  const edit = getExternalEdit(ctx, field);
  const session = edit.session(rc);
  if (!session) return rendered(null);
  return rendered(
    <div className="ff-dialog">
      <strong>Editing pet {session.index + 1}</strong>
      <TextField
        field={session.draft.fields.name}
        label="Name (draft)"
        required
      />
      <p className="hint">
        Lock the pets region while this is open and it closes: the edit began
        there, so that region's lock ends it. An edit begun from the Cards tab
        is not affected, because its origin is a different boundary.
      </p>
      <div className="ff-row">
        <Action
          actionId={StandardActionIds.apply}
          text="Apply"
          style="primary"
          disabled={false}
          onClick={() => edit.apply()}
        />
        <Action
          actionId={StandardActionIds.cancel}
          text="Cancel"
          style="link"
          disabled={false}
          onClick={() => edit.cancel()}
        />
      </div>
    </div>,
  );
}

/**
 * The form. No JSON, no renderer named — this source is identical under every
 * implementation.
 */
export function PersonForm({
  data,
  emailPresence,
  showReference,
  lockPets,
  readOnly,
  disabled,
  clearHidden,
  designMode,
}: {
  data: Control<Person>;
  emailPresence: Presence;
  showReference: boolean;
  lockPets: boolean;
  readOnly: boolean;
  disabled: boolean;
  clearHidden: boolean;
  designMode: boolean;
}): Rendered {
  const { rc, rendered, update } = useReactive();
  const ctx = useControlContext();
  const f = data.fields;
  const Stack = useStack();
  // Buttons outside the list: mutation is not the collection renderer's job.
  const pets = arrayActions(rc, ctx, f.pets, petBounds);
  // The dialog's open state is a control, so `open` binds to it directly —
  // the Control arm of FormProp, no wrapper.
  const detailsOpen = useControl(false);
  const setDetailsOpen = (v: boolean) =>
    update((wc) => wc.setValue(detailsOpen, v));
  // Drives the third-party group's `hidden` on the Cards tab.
  const showCards = useControl(true);
  return rendered(
    <Form
      readOnly={readOnly}
      disabled={disabled}
      clearHidden={clearHidden}
      designMode={designMode}
    >
      <Tabs
        items={[
          {
            key: "details",
            title: "Details",
            children: (
              <Stack gap={4}>
                <Stack direction="row" gap={16}>
                  <TextField
                    field={f.firstName}
                    label="First name"
                    required
                    placeholder="Ada"
                  />
                  <TextField field={f.lastName} label="Last name" />
                </Stack>

                <Panel presence={emailPresence}>
                  <TextField
                    field={f.email}
                    label="Email"
                    startIcon="@"
                    endIcon={(rc) =>
                      (rc.getValue(f.email) ?? "").includes("@") ? "✓" : null
                    }
                    helpText="Validates even while it is not on screen."
                    inputType="email"
                    validate={{
                      shape: (v) =>
                        !v || v.includes("@")
                          ? null
                          : "That does not look like an email",
                      length: (v) => (!v || v.length < 60 ? null : "Too long"),
                    }}
                  />
                </Panel>

                <TextField
                  field={f.notes}
                  multiline
                  label={(rc) =>
                    `Notes (${(rc.getValue(f.notes) ?? "").length} chars)`
                  }
                />

                <SelectField
                  field={f.status}
                  label="Status"
                  options={statusOptions}
                  required
                  helpText="Options are a prop — the schema is loader-only."
                />
                {/* The same field as radios. Per-option content is a render
            prop, called for every option; it gates itself with a hidden
            group rather than unmounting, so the field under Inactive keeps
            validating while Active is chosen. */}
                <RadioField
                  field={f.status}
                  label="Status (as radios)"
                  options={statusOptions}
                  helpText="Same field as the select. Per-option content is a render prop."
                >
                  {(o, selected) => (
                    <Contents hidden={!selected}>
                      {o.value === "inactive" ? (
                        <TextField
                          field={f.notes}
                          label="Why inactive?"
                          multiline
                        />
                      ) : (
                        <TextDisplay text={`${o.name} it is.`} />
                      )}
                    </Contents>
                  )}
                </RadioField>
                {/* A third-party container that produces `silent`: the branch
            the data has not chosen stays mounted and validating — email is
            required only here, and reports while nothing renders. */}
                <SelectChild
                  selected={(rc) => rc.getValue(f.status)}
                  items={[
                    {
                      key: "active",
                      children: (
                        <TextField
                          field={f.email}
                          label="Contact email (active members)"
                          required
                          helpText="Required only in this branch; validates while the branch is silent."
                        />
                      ),
                    },
                    {
                      key: "inactive",
                      children: (
                        <TextDisplay text="Inactive members are not contacted." />
                      ),
                    },
                  ]}
                />
                <TextDisplay text="Authored display — static content, no field." />
                {/* Legacy's Inline group: prose with a bound value in it. The
            children learn they are inline from the scope and draw spans. */}
                <InlineGroup>
                  <TextDisplay text="You rated us " />
                  <DisplayOnlyField field={f.rating} emptyText="nothing yet" />
                  <TextDisplay text=" out of 5, and your status is " />
                  <DisplayOnlyField
                    field={f.status}
                    options={statusOptions}
                    emptyText="unset"
                  />
                  <TextDisplay text="." />
                </InlineGroup>
                {/* The Mast form's shape, hand-written: a glyph pair switched by
            data, each carrying the meaning the glyph does not. Hover for the
            implementation's answer to "is the name also visible". */}
                <Stack direction="row" gap={8} align="center">
                  <IconDisplay
                    icon="person"
                    accessibleName="The operator is a person."
                    hidden={(rc) => rc.getValue(f.status) === "inactive"}
                  />
                  <IconDisplay
                    icon="building"
                    accessibleName="The operator is a business or group."
                    hidden={(rc) => rc.getValue(f.status) !== "inactive"}
                  />
                  <TextDisplay
                    text={(rc) =>
                      rc.getValue(f.status) === "inactive"
                        ? "Business — set status back to Active for the person."
                        : "Person — set status to Inactive for the business."
                    }
                  />
                </Stack>
                {/* The portal container. Its content is `silent` while closed:
            the required field inside validates (see the state table) and the
            trigger reports it. Design mode renders it inline instead. */}
                <Stack direction="row" gap={12} align="center">
                  <Action
                    actionId="openDetails"
                    text="More details…"
                    style="secondary"
                    onClick={() => setDetailsOpen(true)}
                  />
                  <TextDisplay
                    text={(rc) =>
                      rc.getValue(f.lastName)
                        ? `Last name: ${rc.getValue(f.lastName)}`
                        : "Last name missing — required, inside the dialog."
                    }
                  />
                </Stack>
                <Dialog
                  open={detailsOpen}
                  onClose={() => setDetailsOpen(false)}
                  title="More details"
                >
                  <Stack gap={4}>
                    <TextField
                      field={f.lastName}
                      label="Last name"
                      required
                      helpText="Required, and validated while the dialog is closed."
                    />
                    <SelectField
                      field={f.priority}
                      label="Priority"
                      options={[
                        { name: "Low", value: 1 },
                        { name: "High", value: 3 },
                      ]}
                    />
                  </Stack>
                </Dialog>
                <Stars
                  field={f.rating}
                  label="How did we do?"
                  maxStars={5}
                  required
                  requiredMessage="Please rate us"
                  helpText="A third-party widget."
                />
              </Stack>
            ),
          },
          {
            key: "pets",
            title: "Pets",
            children: (
              <Stack gap={4}>
                {/* What replaced <Each>: a boundary, so the array itself gets a
            Length validator, clearHidden, and the cascade. The region around
            it can be locked on its own, and `<Section>` is the same renderer
            with a validation scope — the red bar is its aggregate. */}
                <Section readOnly={lockPets}>
                  <Elements
                    field={f.pets}
                    label="Pets"
                    {...petBounds}
                    helpText="Length 1–3, validated on the array itself."
                    empty={<p className="ff-empty">No pets yet.</p>}
                  >
                    {(pet, i, row) => (
                      <div className="ff-row">
                        <TextField
                          field={pet.fields.name}
                          required
                          label={`Pet ${i + 1}`}
                          placeholder="Rex"
                        />
                        <Action
                          actionId={StandardActionIds.edit}
                          text="Edit"
                          style="secondary"
                          disabled={!row.canEdit}
                          onClick={() => row.edit(i)}
                        />
                        <Action
                          actionId={StandardActionIds.remove}
                          text="Remove"
                          style="secondary"
                          disabled={!row.canRemove}
                          onClick={() => row.remove(i)}
                        />
                      </div>
                    )}
                  </Elements>
                  <Action
                    actionId={StandardActionIds.add}
                    text={`Add pet (${pets.length}/${petBounds.maxLength})`}
                    style="primary"
                    disabled={!pets.canAdd}
                    onClick={() => pets.add({ name: "" })}
                  />
                </Section>

                {/* Outside the region. It reads its own scope; the region's
            lock reaches it only by ending the session it started. */}
                <DraftHost field={f.pets} />

                <CheckboxField
                  field={f.hasPets}
                  label="Has pets"
                  helpText="A widget that labels itself — the shell never sees the label."
                />

                {/* What replaced <Show>: an ordinary chrome-less group. Its children
            stay mounted while hidden — each boundary clears its own field —
            and the group hides them with CSS, so plain JSX inside it goes too. */}
                <Contents hidden={(rc) => !rc.getValue(f.hasPets)}>
                  <TextField
                    field={f.vetName}
                    label="Vet's name"
                    required
                    helpText="Cleared by clearHidden when the region is hidden."
                  />
                </Contents>

                <p className="ff-plain">
                  Plain JSX inside the Pets tab — no boundary suppresses this,
                  so the panel itself has to hide it.
                </p>
                {showReference && <AntInputReference />}
              </Stack>
            ),
          },
          {
            key: "cards",
            title: "Cards",
            children: (
              <Stack gap={4}>
                <p className="ff-plain">
                  The same pets array through a third-party collection renderer
                  — no UI library imported, per-row chrome composed from the
                  implementation's buttons, Edit through the shared staged-edit
                  controller (the modal on the Pets tab opens it). Inside a
                  third-party <em>group</em>: collapse it and the cards keep
                  validating (the badge), hide it and they clear.
                </p>
                <CheckboxField
                  field={showCards}
                  label="Show cards"
                  helpText="Drives the group's hidden prop — not its collapsed state."
                />
                <Collapsible
                  title="Pets as cards"
                  hidden={(rc) => !rc.getValue(showCards)}
                  defaultOpen
                  summary={(rc) => {
                    // `?.` because hiding this group clears the array: the
                    // collection inside is a field boundary bound to `pets`.
                    const n = rc.getValue(f.pets)?.length ?? 0;
                    return `${n} pet${n === 1 ? "" : "s"}`;
                  }}
                >
                  <PetCards
                    field={f.pets}
                    label="Pets as cards"
                    {...petBounds}
                    columns={2}
                    onCardClick={(i) => console.log("card", i)}
                    empty={<p className="ff-empty">No cards.</p>}
                  >
                    {(pet, i) => (
                      <TextField
                        field={pet.fields.name}
                        required
                        label={`Pet ${i + 1}`}
                      />
                    )}
                  </PetCards>
                </Collapsible>
                <DraftHost field={f.pets} />
              </Stack>
            ),
          },
          {
            key: "wizard",
            title: "Wizard",
            children: (
              <Wizard
                page={f.wizardPage}
                items={[
                  {
                    key: "who",
                    title: "Who",
                    children: (
                      <Stack gap={4}>
                        <TextField
                          field={f.lastName}
                          label="Last name"
                          required
                          helpText="Async: an 800 ms name check. Next waits for it, then refuses if it fails — try Smith."
                          validate={{
                            taken: async (v) => {
                              await new Promise((r) => setTimeout(r, 800));
                              return v?.trim().toLowerCase() === "smith"
                                ? "Smith is taken — try another"
                                : null;
                            },
                          }}
                        />
                        <SelectField
                          field={f.status}
                          label="Status"
                          options={statusOptions}
                          required
                        />
                      </Stack>
                    ),
                  },
                  {
                    key: "detail",
                    title: "Detail",
                    children: (
                      <Stack gap={4}>
                        <TextField field={f.email} label="Email" />
                        <TextField field={f.notes} label="Notes" multiline />
                      </Stack>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "json",
            title: "From JSON",
            children: (
              <Stack gap={4}>
                <p className="ff-plain">
                  Loaded from a ControlDefinition[], bound to the same data as
                  the other tabs. No renderer knows JSON exists.
                </p>
                <JsonForm
                  controls={demoControls}
                  schema={demoSchema}
                  data={data}
                  actionHandler={(id, actionData) => {
                    switch (id) {
                      case "apply":
                        return () => new Promise((r) => setTimeout(r, 1200));
                      case "greet":
                        return () =>
                          console.log(
                            `Hello, ${String(actionData ?? "nobody")}`,
                          );
                    }
                    return undefined;
                  }}
                  renderWarnings={(ws) => (
                    <ul className="ff-warnings">
                      {ws.map((w, i) => (
                        <li key={i}>
                          <code>{w.path}</code> <b>{w.kind}</b>
                          {w.subject ? ` · ${w.subject}` : ""} — {w.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                />
              </Stack>
            ),
          },
        ]}
      />
    </Form>,
  );
}
