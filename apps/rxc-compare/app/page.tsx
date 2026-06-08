"use client";

import { JSX, useRef, useState } from "react";
import type { Control } from "@rxc/controls";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import {
  createDataNode,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  groupedControl,
  type FormTreeResolver,
  type SchemaField,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";
import { SchemaMap } from "./schemas";
import { createRegistry } from "./registry";
import { HtmlLayout } from "./HtmlLayout";
import { HtmlLabel } from "./HtmlLabel";
import { HtmlError } from "./HtmlError";
import { fireTheme } from "./theme";
import { FormDefinitions, type FormDefinitionEntry } from "./formDefs";

const schemaMap = SchemaMap as Record<string, SchemaField[]>;

const schemaResolver = createSchemaTreeResolver((name, resolver) => {
  const fields = schemaMap[name];
  if (!fields) return undefined;
  return createStaticSchemaTree(fields, resolver);
});

const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const registry = createRegistry();

const controlContext = createControlContext();

interface FormHostProps {
  def: FormDefinitionEntry;
}

const FormHost = controls<FormHostProps>(
  "FormHost",
  ({ def }, { controlContext: cc }) => {
    const stateRef = useRef<{
      rootControl: Control<Record<string, unknown>>;
      formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
      dataRoot: ReturnType<typeof createDataNode>;
    } | null>(null);

    if (!stateRef.current) {
      const rootControl = cc.newControl<Record<string, unknown>>(
        def.sampleData ?? {},
      );
      const rootTree =
        schemaResolver.getSchemaTree(def.schemaName) ??
        createStaticSchemaTree(def.formFields, schemaResolver);
      const formTree = createStaticFormTree(
        [groupedControl(def.controls as any, def.name)],
        emptyFormResolver,
      );
      const dataRoot = createDataNode(rootTree.rootNode, rootControl);
      stateRef.current = { rootControl, formRoot: formTree.rootNode, dataRoot };
    }

    const { formRoot, dataRoot } = stateRef.current;
    const formNode = useFormStateNode(cc, formRoot, dataRoot, { registry });

    return (
      <Form
        node={formNode}
        registry={registry}
        layout={HtmlLayout}
        label={HtmlLabel}
        error={HtmlError}
        options={{ theme: fireTheme }}
      />
    );
  },
);

const PageInner = controls(function PageInner() {
  const [formKey, setFormKey] = useState<string>("Fire");
  const def = FormDefinitions[formKey];

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-[1280px] mx-auto">
        <div className="flex items-baseline gap-4 mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">{def.name}</h1>
          <label className="flex items-center gap-2 text-sm">
            <span>Form:</span>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
            >
              {Object.entries(FormDefinitions).map(([k, d]) => (
                <option key={k} value={k}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rounded-lg bg-white p-6 shadow">
          {/* `key` forces remount when the form changes so the per-form
              rootControl / formTree / dataRoot are rebuilt cleanly. */}
          <FormHost key={formKey} def={def} />
        </div>
      </div>
    </div>
  );
});

export default function Page(): JSX.Element {
  return (
    <ControlContextProvider value={controlContext}>
      <PageInner />
    </ControlContextProvider>
  );
}
