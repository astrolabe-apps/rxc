"use client";

import {JSX, useMemo} from "react";
import {useControl, useControlEffect} from "@react-typed-forms/core";
import {
  createSchemaDataNode,
  createSchemaLookup,
  groupedControl,
  legacyFormNode,
  RenderForm,
  SchemaField,
} from "@react-typed-forms/schemas";
import {Fire} from "./formDefs";
import {useFormTypeRenderer} from "./renderer";
import {FireRegistrationEditForm, SchemaMap} from "./schemas";

const schemaLookup = createSchemaLookup(
    SchemaMap as Record<string, SchemaField[]>,
);

export default function Page(): JSX.Element {
  const renderer = useFormTypeRenderer("Fire");
  const rootControl = useControl<Partial<FireRegistrationEditForm>>({});
  const schemaTree = schemaLookup.getSchemaTree(Fire.schemaName, Fire.formFields);
  const dataNode = createSchemaDataNode(schemaTree.rootNode, rootControl);
  const formNode = useMemo(() => {
    return legacyFormNode(groupedControl(Fire.controls, Fire.name));
  }, []);
  useControlEffect(() => rootControl.fields.registration.fields.acknowledgement.value, x => console.log(rootControl.fields.registration.fields.acknowledgement))

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{Fire.name}</h1>
        <div className="rounded-lg bg-white p-6 shadow">
          <RenderForm data={dataNode} form={formNode} renderer={renderer} />
        </div>
      </div>
    </div>
  );
}
