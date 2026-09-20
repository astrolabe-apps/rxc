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
  // Label from `displayName`, required from the definition.
  { type: "Data", field: "firstName", required: true },
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
  { type: "Action", actionId: "apply", actionText: "Submit" },
];
