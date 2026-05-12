"use client";

import { useMemo } from "react";
import type { JSX } from "react";
import { newControl } from "@react-typed-forms/core";
import {
  RenderForm,
  createSchemaDataNode,
  createSchemaTree,
  groupedControl,
  legacyFormNode,
} from "@react-typed-forms/schemas";
import { Fire } from "./formDefs";
import { useFormTypeRenderer } from "./renderer";

export default function Page(): JSX.Element {
  const renderer = useFormTypeRenderer("Fire");
  const { dataNode, formNode } = useMemo(() => {
    const rootControl = newControl({});
    const schemaTree = createSchemaTree(Fire.formFields);
    const dataNode = createSchemaDataNode(schemaTree.rootNode, rootControl);
    const formNode = legacyFormNode(groupedControl(Fire.controls, Fire.name));
    return { dataNode, formNode };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{Fire.name}</h1>
        <div className="rounded-lg bg-white p-6 shadow">
          <RenderForm data={dataNode} form={formNode} renderer={renderer} />
        </div>
      </div>
    </div>
  );
}
