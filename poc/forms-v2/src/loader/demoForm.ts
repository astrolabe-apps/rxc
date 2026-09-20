import type { ControlDefinition, SchemaField } from "./json.js";

/** The same data the JSX form binds to — a schema for the loader's use only. */
export const demoSchema: SchemaField[] = [
  { field: "firstName", type: "String", displayName: "First name" },
  { field: "notes", type: "String", displayName: "Notes" },
  { field: "hasPets", type: "Bool", displayName: "Has pets" },
  {
    field: "pets",
    type: "Compound",
    collection: true,
    displayName: "Pets",
    children: [{ field: "name", type: "String", displayName: "Name" }],
  },
  { field: "vetName", type: "String", displayName: "Vet's name" },
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
  // A synchronous one, which becomes `(rc) => …`.
  {
    type: "Data",
    field: "notes",
    renderOptions: { type: "Multiline" },
    dynamic: [
      {
        type: "Disabled",
        expr: { type: "DataMatch", field: "firstName", value: "" },
      },
    ],
  },
  {
    type: "Data",
    field: "pets",
    validators: [{ type: "Length", min: 1, max: 3 }],
    children: [{ type: "Data", field: "name", required: true }],
  },
  { type: "Data", field: "status", required: true },
  { type: "Data", field: "priority" },
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
  // Two shapes that render *something* and quietly lose what the JSON asked
  // for — the failure the warning list exists to catch.
  {
    type: "Data",
    field: "status",
    title: "Status as radios",
    renderOptions: { type: "Radio" },
  },
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
