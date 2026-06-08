"use client";

import { useControl } from "@react-typed-forms/core";
import type { Control } from "@react-typed-forms/core";
import {
  type ArrayElementRenderOptions,
  type ArrayRenderOptions,
  RenderForm,
  buildSchema,
  compoundField,
  createFormRenderer,
  createFormTree,
  createSchemaDataNode,
  createSchemaTree,
  dataControl,
  DataRenderType,
  groupedControl,
  stringField,
} from "@react-typed-forms/schemas";
import {
  createDefaultRenderers,
  defaultTailwindTheme,
} from "@react-typed-forms/schemas-html";

// ── Data shape ──────────────────────────────────────────────────────

interface Contact {
  name: string;
  email: string;
  role: string;
}

interface PageData {
  items: Contact[];
}

// ── Schema ──────────────────────────────────────────────────────────

const ContactSchema = buildSchema<Contact>({
  name: stringField("Name"),
  email: stringField("Email"),
  role: stringField("Role"),
});

const FormSchema = buildSchema<PageData>({
  items: compoundField("Contacts", ContactSchema, { collection: true }),
});

// Shared template — used as the per-row template by the Array renderer,
// and as the modal body by the ArrayElement renderer.
const elementTemplate = [
  groupedControl([
    dataControl("name", "Name", { required: true }),
    dataControl("email", "Email"),
    dataControl("role", "Role"),
  ]),
];

// ── Form definition ─────────────────────────────────────────────────
//
// Two `dataControl`s bound to the SAME `items` field, so they share one
// underlying array `Control` (and therefore one staged-edit session via
// `getExternalEditData(arrayControl)`):
//
//  1. `renderType: Array` + `editExternal: true` — the list. Renders rows
//     inline plus Add / per-row Edit / Remove. With `editExternal`,
//     clicking Add or Edit stages a draft instead of mutating the array.
//  2. `renderType: ArrayElement` — the modal host. Renders nothing
//     normally; when a draft is staged on the shared array control, it
//     pops a dialog with the draft form + Cancel / Apply. Apply
//     validates the draft (clear Name to see it block), then commits.
const formControls = [
  dataControl("items", "Contacts", {
    renderOptions: {
      type: DataRenderType.Array,
      editExternal: true,
      addText: "Add contact",
    } as ArrayRenderOptions,
    children: elementTemplate,
  }),
  dataControl("items", undefined, {
    hideTitle: true,
    renderOptions: {
      type: DataRenderType.ArrayElement,
    } as ArrayElementRenderOptions,
    children: elementTemplate,
  }),
];

const formTree = createFormTree(formControls);
const schemaTree = createSchemaTree(FormSchema);

const formRenderer = createFormRenderer(
  [],
  createDefaultRenderers(defaultTailwindTheme),
);

// ── Live JSON sidebar ───────────────────────────────────────────────

import { useControlEffect } from "@react-typed-forms/core";
import { useState } from "react";

function LiveJson({ control }: { control: Control<unknown> }) {
  const [value, setValue] = useState(() => control.value);
  useControlEffect(
    () => control.value,
    (v) => setValue(v),
  );
  return (
    <pre className="overflow-auto rounded bg-zinc-50 p-3 text-xs font-mono whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Page ────────────────────────────────────────────────────────────

export default function ExternalEditPage() {
  const data = useControl<PageData>({
    items: [{ name: "Ada Lovelace", email: "ada@example.com", role: "Engineer" }],
  });

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">
          external-edit demo (legacy)
        </h1>
        <p className="mb-6 text-sm text-zinc-600">
          Reference rendering via{" "}
          <code>@react-typed-forms/schemas-html</code> (≥5.2.1) with{" "}
          <code>defaultTailwindTheme</code>. The same{" "}
          <code>items</code> field is bound by two sibling{" "}
          <code>dataControl</code>s: a{" "}
          <code>renderType: Array</code> list with{" "}
          <code>editExternal: true</code> (Add / Edit / Remove buttons),
          and a <code>renderType: ArrayElement</code> modal host that
          renders nothing until a draft is staged. Click <b>Add</b> or a
          row&apos;s <b>Edit</b> — a modal opens with the draft fields;{" "}
          <b>Apply</b> commits, <b>Cancel</b> discards. Pair with the rxc
          demo at <code>localhost:3000/externaledit</code> to compare the
          modal chrome and behavior side by side.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <RenderForm
              data={createSchemaDataNode(schemaTree.rootNode, data)}
              form={formTree.rootNode}
              renderer={formRenderer}
            />
          </div>
          <div className="rounded-lg bg-white p-4 shadow lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">
              Form data (live JSON)
            </h2>
            <LiveJson control={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
