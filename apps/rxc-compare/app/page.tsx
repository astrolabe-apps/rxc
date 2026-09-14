"use client";

import { JSX, useEffect, useRef, useState } from "react";
import type { Control } from "@rx-controls/react";
import { useReactive, useControlContext, type Rendered, ControlContextProvider, createControlContext, effect } from "@rx-controls/react";
import { ActionScope } from "@rx-controls/forms";
import { clientSearchPage, fieldClientSearch } from "@rx-controls/forms-datagrid";
import type { SearchOptions } from "@astroapps/searchstate";
import {
  createDataNode,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  groupedControl,
  type DataNode,
  type FormNode,
  type FormTreeResolver,
  type SchemaField,
} from "@rx-controls/forms-core";
import { Form, useFormStateNode, type FormRegistry } from "@rx-controls/forms";
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

// Per-form registry cache: a form can request a DataGrid `rowClass` (the one
// class slot set at renderer-construction time, not via form JSON), so the
// scratch form gets a striped registry without disturbing the others.
const registryCache = new Map<string, FormRegistry>();
function registryFor(rowClass?: string) {
  if (!rowClass) return registry;
  let reg = registryCache.get(rowClass);
  if (!reg) {
    reg = createRegistry({ rowClass });
    registryCache.set(rowClass, reg);
  }
  return reg;
}

const controlContext = createControlContext();

interface FormHostProps {
  def: FormDefinitionEntry;
}

function FormHost({ def }: FormHostProps): Rendered {
  const { rc, rendered } = useReactive();
  const cc = useControlContext();
  const stateRef = useRef<{
    rootControl: Control<Record<string, unknown>>;
    formRoot: FormNode;
    dataRoot: DataNode;
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
  const formRegistry = registryFor(def.gridRowClass);
  const formNode = useFormStateNode(cc, formRoot, dataRoot, {
    registry: formRegistry,
  });

  // Client-side search: stand in for a server by recomputing the bound
  // `results.{entries,total}` from `allRows` + the `request` SearchOptions
  // whenever a filter/sort/page changes. Wired post-commit so the initial
  // SSR snapshot (seeded `results`) and first hydration agree.
  useEffect(() => {
    const cs = def.clientSearch;
    if (!cs) return;
    const root = stateRef.current!.rootControl;
    const reqControl = root.fields.request as unknown as Control<SearchOptions>;
    const resultsControl = root.fields.results as unknown as Control<{
      total: number;
      entries: unknown[];
    }>;
    const client = fieldClientSearch<Record<string, unknown>>({
      searchableFields: cs.searchableFields,
    });
    const eff = effect(cc, (rc) => {
      // Track the whole request Value (not getTrackedValue): the `filters`
      // object has dynamic keys read via Object.keys(), which bypasses
      // getTrackedValue's per-field proxy tracking, so a filter toggle (a Value
      // change, not Structure) would otherwise not re-run this effect.
      const req = rc.getValue(reqControl);
      const { entries, total } = clientSearchPage(cs.allRows, req, client);
      cc.update((wc) => {
        wc.setValue(resultsControl.fields.total, total);
        wc.setValue(resultsControl.fields.entries, entries);
      });
    });
    return () => eff.cleanup();
  }, [def]);

  return rendered(
    <ActionScope
      onAction={(actionId, actionData) => {
        if (actionId === "viewDetail") {
          // Host stub — a real portal would route to the detail page.
          // eslint-disable-next-line no-console
          console.log("viewDetail", actionData);
          return true;
        }
        return undefined;
      }}
    >
      <Form
        node={formNode}
        registry={formRegistry}
        layout={HtmlLayout}
        label={HtmlLabel}
        error={HtmlError}
        options={{ theme: fireTheme }}
      />
    </ActionScope>
  );
}

function PageInner(): Rendered {
  const { rc, rendered } = useReactive();
  const [formKey, setFormKey] = useState<string>("Fire");
  const def = FormDefinitions[formKey];

  return rendered(
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
}

export default function Page(): JSX.Element {
  return (
    <ControlContextProvider value={controlContext}>
      <PageInner />
    </ControlContextProvider>
  );
}
