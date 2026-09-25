import type { ControlDefinition, SchemaField } from "./json.js";

/** The same data the JSX form binds to — a schema for the loader's use only. */
export const demoSchema: SchemaField[] = [
  { field: "firstName", type: "String", displayName: "First name" },
  { field: "notes", type: "String", displayName: "Notes" },
  { field: "hasPets", type: "Bool", displayName: "Has pets" },
  { field: "alerts", type: "Bool", displayName: "Alerts" },
  {
    field: "pets",
    type: "Compound",
    collection: true,
    displayName: "Pets",
    children: [{ field: "name", type: "String", displayName: "Name" }],
  },
  { field: "vetName", type: "String", displayName: "Vet's name" },
  {
    field: "address",
    type: "Compound",
    displayName: "Address",
    children: [
      { field: "street", type: "String", displayName: "Street" },
      { field: "city", type: "String", displayName: "City" },
    ],
  },
  { field: "joined", type: "Date", displayName: "Joined" },
  {
    field: "status",
    type: "String",
    displayName: "Status",
    options: [
      { name: "Active", value: "active" },
      { name: "Inactive", value: "inactive" },
    ],
  },
  {
    // Numeric option values, which the DOM erases to strings on the way out.
    field: "priority",
    type: "Int",
    displayName: "Priority",
    options: [
      { name: "Low", value: 1 },
      { name: "High", value: 3 },
    ],
  },
];

export const demoControls: ControlDefinition[] = [
  // Label from `displayName`, required from the definition — and the class
  // slots: `styleClass` merges onto the control, `textClass` onto its text,
  // and an `"@ "` prefix replaces the implementation's class outright.
  {
    type: "Data",
    field: "firstName",
    required: true,
    renderOptions: { type: "Textfield", placeholder: "Given name" },
    styleClass: "demo-accent",
    labelClass: "demo-label",
    labelTextClass: "demo-label-text",
    layoutClass: "@ demo-shell",
  },
  { type: "Data", field: "hasPets" },
  // An async jsonata expression, which can only become a `FormProp` by
  // evaluating into a control.
  {
    type: "Data",
    field: "vetName",
    required: true,
    // The default-value cycle: hidden → cleared → shown → defaulted again.
    defaultValue: "Dr. Dolittle",
    dynamic: [
      {
        type: "Visible",
        expr: { type: "Jsonata", expression: "hasPets = true" },
      },
    ],
  },
  // A group with a title legacy would show, and one that hides it.
  {
    type: "Group",
    title: "Contact",
    groupOptions: { type: "Standard", hideTitle: false },
    children: [
      {
        type: "Data",
        field: "firstName",
        hideTitle: true,
        title: "Hidden label",
      },
    ],
  },
  // A synchronous one, which becomes `(rc) => …` — and a Jsonata validator,
  // which is an async validator evaluated against the parent data.
  {
    type: "Data",
    field: "notes",
    renderOptions: { type: "Multiline" },
    validators: [
      {
        type: "Jsonata",
        expression:
          "$contains(notes, 'TODO') ? 'Notes still contain a TODO' : null",
      },
    ],
    dynamic: [
      {
        type: "Disabled",
        expr: { type: "DataMatch", field: "firstName", value: "" },
      },
    ],
  },
  // Legacy's Array: Add below, Remove per row, `noReorder` read and ignored
  // as legacy's Array renderer did.
  {
    type: "Data",
    field: "pets",
    renderOptions: { type: "Array", addText: "Add a pet", noReorder: true },
    validators: [{ type: "Length", min: 1, max: 3 }],
    children: [
      { type: "Data", field: "name", required: true },
      // Inside a row: `$i` is the row index and `$$` the form's root, as
      // legacy prefixes the expression (`pets#$i[N].(…)`).
      {
        type: "Data",
        field: "name",
        renderOptions: { type: "DisplayOnly", emptyText: "(unnamed)" },
        dynamic: [
          {
            type: "Label",
            expr: {
              type: "Jsonata",
              expression: "'Pet ' & ($i + 1) & ' of ' & $count($$.pets)",
            },
          },
        ],
      },
    ],
  },
  // A HelpText adornment lands as the shell's help text; its `placement`
  // (here LabelEnd) is dropped on purpose — the shell decides where help goes.
  {
    type: "Data",
    field: "status",
    required: true,
    adornments: [
      {
        type: "HelpText",
        helpText: "The member's current standing.",
        helpLabel: "Status",
        placement: "LabelEnd",
      },
    ],
  },
  { type: "Data", field: "priority" },
  // Legacy's Inline group — the corpus's receipt-page shape: prose with a
  // bound value and a link in it. Title hidden, as 214 of 222 are.
  {
    type: "Group",
    title: "Summary",
    groupOptions: { type: "Inline", hideTitle: true },
    children: [
      {
        type: "Display",
        displayData: { type: "Text", text: "Your status is " },
      },
      {
        type: "Data",
        field: "status",
        hideTitle: true,
        renderOptions: { type: "DisplayOnly", emptyText: "not set" },
      },
      { type: "Display", displayData: { type: "Text", text: " — " } },
      {
        type: "Action",
        actionId: "greet",
        actionText: "say hello",
        actionStyle: "Link",
      },
      { type: "Display", displayData: { type: "Text", text: "." } },
    ],
  },
  // Field references, legacy's `dataRef`: `a/b` binds into a compound from
  // outside it; inside the compound's region, `../x` climbs back out.
  {
    type: "Data",
    field: "address/city",
    title: "City — bound as address/city",
  },
  // A compound rendered as a group, with the group kind nested under
  // renderOptions — here a Flex row.
  {
    type: "Data",
    field: "address",
    renderOptions: { type: "Group", groupOptions: { type: "Flex" } },
    children: [
      { type: "Data", field: "street" },
      {
        type: "Data",
        field: "../firstName",
        title: "First name — bound as ../firstName",
        renderOptions: {
          type: "DisplayOnly",
          emptyText: "(no first name yet)",
        },
      },
    ],
  },
  // DisplayOnly: options by name, a date by type, a boolean as Yes/No.
  {
    type: "Data",
    field: "status",
    title: "Status (read-only)",
    renderOptions: { type: "DisplayOnly", emptyText: "No status chosen" },
  },
  {
    type: "Data",
    field: "joined",
    renderOptions: { type: "DisplayOnly", sampleText: "1/1/2024" },
  },
  // Legacy's Date validator — the corpus's one shape, an offset from today.
  {
    type: "Data",
    field: "joined",
    title: "Joined (must not be in the future)",
    validators: [{ type: "Date", comparison: "NotAfter", daysFromCurrent: 0 }],
  },
  {
    type: "Data",
    field: "hasPets",
    title: "Has pets (read-only)",
    renderOptions: { type: "DisplayOnly" },
  },
  {
    type: "Display",
    displayData: { type: "Text", text: "A text display — no binding at all." },
  },
  {
    type: "Display",
    displayData: {
      type: "Html",
      html: "An <b>html</b> display, <i>same markup everywhere</i>.",
    },
  },
  // Nothing translates this one, so the loader says so on screen.
  { type: "Display", displayData: { type: "Custom" }, title: "Custom" },
  // …and this one the host's `displays` map answers, by id.
  {
    type: "Display",
    displayData: { type: "Custom", customId: "greeting" },
    title: "Greeting",
  },
  // ── the host's extensions (src/loader/pocHost.tsx) ──
  // A host render type: ServiceTas's Switch, `displayLabel: false` and all.
  {
    type: "Data",
    field: "alerts",
    title: "Push notifications",
    renderOptions: { type: "Switch", displayLabel: false },
  },
  // A host group kind, with its own options.
  {
    type: "Group",
    title: "Heads up",
    groupOptions: { type: "MessageBox", level: "warning" },
    children: [
      {
        type: "Display",
        displayData: { type: "Text", text: "A host group kind — MessageBox." },
      },
    ],
  },
  // A host group kind over a compound: gets the loader's `CompoundCycle`.
  {
    type: "Data",
    field: "address",
    title: "Address (top-level)",
    renderOptions: { type: "Group", groupOptions: { type: "TopLevelGroup" } },
    children: [{ type: "Data", field: "street" }],
  },
  // A host adornment, wrapping what translated.
  {
    type: "Data",
    field: "firstName",
    title: "Spotlit",
    adornments: [{ type: "Spotlight", index: 2 }],
  },
  // The host's Spotlight declines nothing, but its HelpText declines a Group
  // — reported, as the loader's own would have.
  {
    type: "Group",
    title: "Help on a group",
    groupOptions: { type: "Standard" },
    adornments: [{ type: "HelpText", helpText: "Nowhere to go." }],
    children: [{ type: "Data", field: "notes" }],
  },
  // The Mast form's real shape: a bare icon whose meaning the legacy Tooltip
  // adornment supplied. It translates to the display's accessible name.
  {
    type: "Display",
    title: "Operator type",
    displayData: {
      type: "Icon",
      icon: { library: "fa-regular", name: "person" },
    },
    adornments: [{ type: "Tooltip", tooltip: "The operator is a person." }],
  },
  // A Tooltip anywhere else has nothing to become, and is reported.
  {
    type: "Data",
    field: "firstName",
    title: "Tooltipped field",
    adornments: [{ type: "Tooltip", tooltip: "Family name." }],
  },
  // Radio with legacy's per-option children: a description under every
  // option (ShortTermPermit's shape — a Display whose text is a jsonata
  // lookup on `$formData.option.value`), and a detail group shown under the
  // chosen one (TUP's shape — `Visible` on `$formData.optionSelected`).
  {
    type: "Data",
    field: "status",
    title: "Status as radios",
    renderOptions: {
      type: "Radio",
      entryWrapperClass: "demo-entry",
      selectedClass: "demo-entry--on",
    },
    children: [
      {
        type: "Display",
        displayData: { type: "Text", text: "" },
        styleClass: "demo-entry-note",
        dynamic: [
          {
            type: "Display",
            expr: {
              type: "Jsonata",
              expression:
                "{'active': 'A current member.', 'inactive': 'Membership has lapsed.'}.$lookup($formData.option.value)",
            },
          },
        ],
      },
      {
        type: "Group",
        groupOptions: { type: "Contents" },
        dynamic: [
          {
            type: "Visible",
            expr: { type: "Jsonata", expression: "$formData.optionSelected" },
          },
        ],
        children: [
          {
            type: "Data",
            field: "notes",
            title: "Notes for this status",
            renderOptions: { type: "Multiline" },
          },
        ],
      },
    ],
  },
  // AllowedOptions, both halves of legacy's rule. A Bool with no schema
  // options at all, whose expression builds whole options with boolean
  // values (MastEoi's Yes/No radios) …
  {
    type: "Data",
    field: "hasPets",
    title: "Has pets (radio from AllowedOptions)",
    renderOptions: { type: "Radio" },
    dynamic: [
      {
        type: "AllowedOptions",
        expr: {
          type: "Jsonata",
          expression:
            '[{"name": "Yes, I have pets", "value": true}, {"name": "No pets", "value": false}]',
        },
      },
    ],
  },
  // … and a filter over the schema's options, driven by data: a null entry
  // drops out, as legacy's did.
  {
    type: "Data",
    field: "status",
    title: "Status (Inactive only with pets)",
    renderOptions: { type: "Dropdown" },
    dynamic: [
      {
        type: "AllowedOptions",
        expr: {
          type: "Jsonata",
          expression: "['active', hasPets ? 'inactive' : null]",
        },
      },
    ],
  },
  // A shape that renders *something* and quietly loses what the JSON asked
  // for — the failure the warning list exists to catch.
  {
    type: "Data",
    field: "firstName",
    title: "Styled name",
    dynamic: [
      { type: "Style", expr: { type: "Data", field: "status" } } as never,
    ],
  },
  {
    type: "Action",
    actionId: "apply",
    actionText: "Submit",
    actionStyle: "Button",
    icon: { library: "fa", name: "check" },
    disableType: "Global",
  },
  // A static payload, and one the data supplies at click time.
  {
    type: "Action",
    actionId: "greet",
    actionText: "Greet (static data)",
    actionData: "hello",
    actionStyle: "Secondary",
  },
  {
    type: "Action",
    actionId: "greet",
    actionText: "Greet (dynamic data)",
    actionStyle: "Link",
    iconPlacement: "AfterText",
    icon: { library: "fa", name: "arrow-right" },
    dynamic: [
      { type: "ActionData", expr: { type: "Data", field: "firstName" } },
    ],
  },
  // Nobody handles this one — the loader says so instead of shipping a dead button.
  { type: "Action", actionId: "launchRockets", actionText: "Unclaimed" },
  // Legacy's Dialog group: the trigger opens it by action id.
  {
    type: "Group",
    title: "Notes dialog",
    groupOptions: { type: "Dialog", title: "Edit notes" },
    children: [
      {
        type: "Action",
        actionId: "openDialog",
        actionText: "Edit notes…",
        placement: "trigger",
      },
      { type: "Data", field: "notes", renderOptions: { type: "Multiline" } },
      { type: "Action", actionId: "closeDialog", actionText: "Done" },
    ],
  },
];
