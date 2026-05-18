"use client";

import { JSX, useMemo, useRef } from "react";
import type { Control } from "@rxc/controls";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import {
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  groupedControl,
  type FormTreeResolver,
  type SchemaField,
  type SchemaTree,
  type SchemaTreeResolver,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";
import FireJson from "./formDefs/Fire.json";
import { FireRegistrationEditForm, SchemaMap } from "./schemas";
import { createRegistry } from "./registry";
import { HtmlLayout } from "./HtmlLayout";
import { HtmlLabel } from "./HtmlLabel";
import { HtmlError } from "./HtmlError";
import { fireTheme } from "./theme";

const Fire = {
  name: "Fire",
  schemaName: "FireRegistrationEdit",
  controls: FireJson.controls,
  formFields: FireJson.fields as SchemaField[],
};

const schemaMap = SchemaMap as Record<string, SchemaField[]>;

function makeSchemaResolver(
  map: Record<string, SchemaField[]>,
): SchemaTreeResolver {
  const cache = new Map<string, SchemaTree>();
  const resolver: SchemaTreeResolver = {
    getSchemaTree(name: string): SchemaTree | undefined {
      const cached = cache.get(name);
      if (cached) return cached;
      const fields = map[name];
      if (!fields) return undefined;
      const tree = createStaticSchemaTree(fields, resolver);
      cache.set(name, tree);
      return tree;
    },
  };
  return resolver;
}

const schemaResolver = makeSchemaResolver(schemaMap);

const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const registry = createRegistry();

const controlContext = createControlContext();

const PageInner = controls(function PageInner({}, { controlContext: cc }) {
  const stateRef = useRef<{
    rootControl: Control<Partial<FireRegistrationEditForm>>;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!stateRef.current) {
    const rootControl = cc.newControl<Partial<FireRegistrationEditForm>>({});
    const rootTree =
      schemaResolver.getSchemaTree(Fire.schemaName) ??
      createStaticSchemaTree(Fire.formFields, schemaResolver);
    const formTree = createStaticFormTree(
      [groupedControl(Fire.controls as any, Fire.name)],
      emptyFormResolver,
    );
    const dataRoot = createDataNode(rootTree.rootNode, rootControl);
    stateRef.current = {
      rootControl,
      formRoot: formTree.rootNode,
      dataRoot,
    };
  }

  const { formRoot, dataRoot } = stateRef.current;

  const formNode = useFormStateNode(cc, formRoot, dataRoot, { registry });

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">{Fire.name}</h1>
        <div className="rounded-lg bg-white p-6 shadow">
          <Form
            node={formNode}
            registry={registry}
            layout={HtmlLayout}
            label={HtmlLabel}
            error={HtmlError}
            options={{ theme: fireTheme }}
          />
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
