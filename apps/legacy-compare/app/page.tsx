"use client";

import { JSX, useMemo, useState } from "react";
import { useControl } from "@react-typed-forms/core";
import {
  createSchemaDataNode,
  createSchemaLookup,
  groupedControl,
  legacyFormNode,
  RenderForm,
  SchemaField,
} from "@react-typed-forms/schemas";
import { FormDefinitions } from "./formDefs";
import { useFormTypeRenderer } from "./renderer";
import { SchemaMap } from "./schemas";

const schemaLookup = createSchemaLookup(
  SchemaMap as Record<string, SchemaField[]>,
);

type FormKey = keyof typeof FormDefinitions;

function FormHost({ formKey }: { formKey: FormKey }): JSX.Element {
  const def = FormDefinitions[formKey];
  const renderer = useFormTypeRenderer(formKey);
  const rootControl = useControl<Record<string, unknown>>(
    (def as { sampleData?: Record<string, unknown> }).sampleData ?? {},
  );
  const schemaTree = schemaLookup.getSchemaTree(def.schemaName, def.formFields);
  const dataNode = createSchemaDataNode(schemaTree.rootNode, rootControl);
  const formNode = useMemo(
    () => legacyFormNode(groupedControl(def.controls, def.name)),
    [formKey],
  );
  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <RenderForm data={dataNode} form={formNode} renderer={renderer} />
    </div>
  );
}

export default function Page(): JSX.Element {
  const [formKey, setFormKey] = useState<FormKey>("Fire");
  const def = FormDefinitions[formKey];
  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline gap-4 mb-4">
          <h1 className="text-2xl font-bold text-zinc-900">{def.name}</h1>
          <label className="flex items-center gap-2 text-sm">
            <span>Form:</span>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value as FormKey)}
            >
              {Object.entries(FormDefinitions).map(([k, d]) => (
                <option key={k} value={k}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* `key` forces remount on form change so the underlying useControl
            is reset (the control is typed differently per form). */}
        <FormHost key={formKey} formKey={formKey} />
      </div>
    </div>
  );
}
