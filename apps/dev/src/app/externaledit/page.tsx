"use client";

import { useRef } from "react";
import { useReactive, type Rendered, useControlContext, ControlContextProvider, createControlContext } from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  type ArrayElementRenderOptions,
  type ArrayRenderOptions,
  buildSchema,
  compoundField,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  DataRenderType,
  groupedControl,
  stringField,
  type ControlDefinition,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type SchemaField,
  type SchemaTreeResolver,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";

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

const ContactSchema: SchemaField[] = buildSchema<Contact>({
  name: stringField("Name"),
  email: stringField("Email"),
  role: stringField("Role"),
});

const FormSchema: SchemaField[] = buildSchema<PageData>({
  items: compoundField("Contacts", ContactSchema, { collection: true }),
});

// Shared per-row template — used both as the array's child template
// (rendered inline for each row) and as the modal body (rendered against
// the staged-edit draft data).
const elementTemplate: ControlDefinition[] = [
  groupedControl([
    dataControl("name", "Name", { required: true }),
    dataControl("email", "Email"),
    dataControl("role", "Role"),
  ]),
];

// ── Form definition ─────────────────────────────────────────────────
//
// Two `dataControl`s bound to the SAME `items` field, matching the
// legacy `@react-typed-forms/schemas-html` two-sibling pattern:
//
//  1. `renderType: Array` + `editExternal: true` — the list. Renders
//     each element inline (via `elementTemplate`) plus Add / per-row
//     Remove buttons. Clicking Add stages a draft via
//     `getExternalEdit` instead of pushing to the array.
//  2. `renderType: ArrayElement` — the modal host. Renders nothing
//     until a draft is staged; when one is, pops a `<dialog>` with
//     the draft form + Cancel / Apply. Apply validates and commits.
//
// Both controls resolve to the SAME underlying array `Control`, so
// `getExternalEdit(arrayNode)` returns the same controller — the list's
// Add button and the modal host's display are wired through the same
// staged-edit session.
function pageFormDef(): GroupedControlsDefinition {
  return groupedControl(
    [
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
    ],
    "External-edit demo",
  );
}

// ── Page ────────────────────────────────────────────────────────────

const emptySchemaResolver: SchemaTreeResolver = {
  getSchemaTree: () => undefined,
};
const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const controlContext = createControlContext();

function ExternalEditInner(): Rendered {
  const { rc, rendered } = useReactive();
  const controlContext = useControlContext();
  const ref = useRef<{
    rootControl: Control<PageData>;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!ref.current) {
    const rootControl = controlContext.newControl<PageData>({
      items: [{ name: "Ada", email: "ada@example.com", role: "Engineer" }],
    });
    const schemaTree = createStaticSchemaTree(
      FormSchema,
      emptySchemaResolver,
    );
    const formTree = createStaticFormTree([pageFormDef()], emptyFormResolver);
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    ref.current = { rootControl, formRoot: formTree.rootNode, dataRoot };
  }

  const { rootControl, formRoot, dataRoot } = ref.current;
  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  return rendered(
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          external-edit demo
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          The same <code>items</code> array is bound by two sibling{" "}
          <code>dataControl</code>s — matching the legacy{" "}
          <code>@react-typed-forms/schemas-html</code> pattern. The first
          has <code>renderType: Array</code> +{" "}
          <code>editExternal: true</code> and renders the list inline
          with an Add button. The second has{" "}
          <code>renderType: ArrayElement</code> and renders nothing until
          a draft is staged; when one is, it pops a modal with the draft
          form + Apply / Cancel. Watch the JSON sidebar: the live array
          stays untouched while a draft is open and only mutates on Apply.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
            <Form node={formNode} />
          </div>
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Form data (live JSON)
            </h2>
            <DataJson control={rootControl} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DataJson({ control }: { control: Control<unknown> }): Rendered {
  const { rc, rendered } = useReactive();
  const value = rc.getValue(control);
  return rendered(
    <pre className="overflow-auto rounded bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 p-3 text-xs font-mono whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function ExternalEditPage() {
  return (
    <ControlContextProvider value={controlContext}>
      <ExternalEditInner />
    </ControlContextProvider>
  );
}
