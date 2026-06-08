"use client";

import { JSX, useMemo, useState } from "react";
import { useControl, useControlEffect } from "@react-typed-forms/core";
import {
  createSchemaDataNode,
  createSchemaLookup,
  groupedControl,
  legacyFormNode,
  RenderForm,
  SchemaField,
} from "@react-typed-forms/schemas";
import {
  type ClientSideSearching,
  getPageOfResults,
  makeClientSortAndFilter,
  type SearchOptions,
} from "@astroapps/searchstate";
import { FormDefinitions } from "./formDefs";
import { useFormTypeRenderer } from "./renderer";
import { SchemaMap } from "./schemas";

// Field-based client search identical to the rxc compare app's
// `fieldClientSearch` (@rxc/forms-datagrid) so both apps compute the same
// filtered/sorted/paged rows from the same seed.
function makeFieldClient(
  searchableFields: string[] | undefined,
): ClientSideSearching<Record<string, unknown>> {
  const fields = searchableFields ?? [];
  const getSearchText =
    fields.length === 0
      ? () => ""
      : (row: Record<string, unknown>) =>
          fields
            .map((f) => {
              const v = row[f];
              return v == null ? "" : String(v);
            })
            .join(" ")
            .toLowerCase();
  return {
    getSearchText,
    getComparison: (field) => (a, b) => {
      const av = a[field] as unknown;
      const bv = b[field] as unknown;
      if (av === bv) return 0;
      if (av == null) return -1;
      if (bv == null) return 1;
      return av < bv ? -1 : 1;
    },
    getFilterValue: (field) => (row) => row[field],
  };
}

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

  // Client-side search: recompute the bound `results.{entries,total}` from
  // `allRows` + the `request` SearchOptions on every filter/sort/page/query
  // change. Mirrors the rxc compare app's effect so both stay in sync.
  const clientSearch = (def as {
    clientSearch?: {
      allRows: Record<string, unknown>[];
      searchableFields?: string[];
    };
  }).clientSearch;
  const allRows = clientSearch?.allRows;
  const sortAndFilter = useMemo(
    () => makeClientSortAndFilter(makeFieldClient(clientSearch?.searchableFields)),
    [clientSearch?.searchableFields],
  );
  useControlEffect(
    () => {
      if (!allRows) return undefined;
      const req = (rootControl.fields as any).request;
      return [
        req.fields.filters.value,
        req.fields.sort.value,
        req.fields.offset.value,
        req.fields.length.value,
        req.fields.query.value,
      ] as const;
    },
    () => {
      if (!allRows) return;
      const req = (rootControl.fields as any).request.value as SearchOptions;
      const filtered = sortAndFilter(req, allRows);
      const length = req.length ?? filtered.length;
      const entries = getPageOfResults(req.offset ?? 0, length, filtered);
      const results = (rootControl.fields as any).results;
      results.fields.total.value = filtered.length;
      results.fields.entries.value = entries;
    },
    true,
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
      <div className="max-w-[1280px] mx-auto">
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
