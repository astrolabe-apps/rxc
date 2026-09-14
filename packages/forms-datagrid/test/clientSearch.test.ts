import { describe, it, expect } from "vitest";
import {
  clientSearchPage,
  fieldClientSearch,
  schemaClientSearch,
} from "../src/clientSearch";
import type { SearchOptions } from "@astroapps/searchstate";
import {
  defaultSchemaInterface,
  FieldType,
  type SchemaField,
} from "@rx-controls/forms-core";

type Row = { id: string; status: string; name: string };

const rows: Row[] = [
  { id: "1", status: "Submitted", name: "Ava" },
  { id: "2", status: "Draft", name: "Liam" },
  { id: "3", status: "Completed", name: "Mia" },
  { id: "4", status: "Submitted", name: "Noah" },
  { id: "5", status: "Draft", name: "Emma" },
];

const client = fieldClientSearch<Row>();

const search = (over: Partial<SearchOptions>): SearchOptions => ({
  query: null,
  sort: [],
  filters: {},
  offset: 0,
  length: 10,
  ...over,
});

describe("clientSearchPage", () => {
  it("returns all rows with total when unfiltered", () => {
    const { entries, total } = clientSearchPage(rows, search({}), client);
    expect(total).toBe(5);
    expect(entries.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("filters by a column value and reports the filtered total", () => {
    const { entries, total } = clientSearchPage(
      rows,
      search({ filters: { status: ["Submitted"] } }),
      client,
    );
    expect(total).toBe(2);
    expect(entries.map((r) => r.id)).toEqual(["1", "4"]);
  });

  it("supports multi-value (OR) filters", () => {
    const { total } = clientSearchPage(
      rows,
      search({ filters: { status: ["Submitted", "Draft"] } }),
      client,
    );
    expect(total).toBe(4);
  });

  it("sorts ascending and descending by a field", () => {
    const asc = clientSearchPage(rows, search({ sort: ["aname"] }), client);
    expect(asc.entries.map((r) => r.name)).toEqual([
      "Ava",
      "Emma",
      "Liam",
      "Mia",
      "Noah",
    ]);
    const desc = clientSearchPage(rows, search({ sort: ["dname"] }), client);
    expect(desc.entries.map((r) => r.name)).toEqual([
      "Noah",
      "Mia",
      "Liam",
      "Emma",
      "Ava",
    ]);
  });

  it("pages by offset/length while total stays the full filtered count", () => {
    const page1 = clientSearchPage(
      rows,
      search({ offset: 0, length: 2 }),
      client,
    );
    expect(page1.total).toBe(5);
    expect(page1.entries.map((r) => r.id)).toEqual(["1", "2"]);

    const page2 = clientSearchPage(
      rows,
      search({ offset: 2, length: 2 }),
      client,
    );
    expect(page2.entries.map((r) => r.id)).toEqual(["3", "4"]);

    const page3 = clientSearchPage(
      rows,
      search({ offset: 4, length: 2 }),
      client,
    );
    expect(page3.entries.map((r) => r.id)).toEqual(["5"]);
  });

  it("filters by query when searchableFields is provided", () => {
    const c = fieldClientSearch<Row>({ searchableFields: ["name", "status"] });
    const { entries, total } = clientSearchPage(
      rows,
      search({ query: "ava" }),
      c,
    );
    expect(total).toBe(1);
    expect(entries.map((r) => r.id)).toEqual(["1"]);
  });

  it("query search is case-insensitive and matches across fields", () => {
    const c = fieldClientSearch<Row>({ searchableFields: ["name", "status"] });
    const { entries, total } = clientSearchPage(
      rows,
      search({ query: "DRAFT" }),
      c,
    );
    expect(total).toBe(2);
    expect(entries.map((r) => r.id)).toEqual(["2", "5"]);
  });

  it("custom getSearchText overrides searchableFields", () => {
    const c = fieldClientSearch<Row>({
      getSearchText: (r) => `row-${r.id}`,
    });
    const { entries, total } = clientSearchPage(
      rows,
      search({ query: "row-3" }),
      c,
    );
    expect(total).toBe(1);
    expect(entries.map((r) => r.id)).toEqual(["3"]);
  });

  it("combines filter + sort + paging", () => {
    const { entries, total } = clientSearchPage(
      rows,
      search({
        filters: { status: ["Submitted", "Draft"] },
        sort: ["aname"],
        offset: 1,
        length: 2,
      }),
      client,
    );
    // Submitted+Draft = Ava, Liam, Noah, Emma → sorted: Ava, Emma, Liam, Noah
    // offset 1, length 2 → Emma, Liam
    expect(total).toBe(4);
    expect(entries.map((r) => r.name)).toEqual(["Emma", "Liam"]);
  });
});

describe("schemaClientSearch", () => {
  type SRow = { points: number; status: string; owner: { name: string } };

  const sfields: SchemaField[] = [
    { type: FieldType.Int, field: "points" },
    {
      type: FieldType.String,
      field: "status",
      options: [
        { name: "Submitted", value: "S" },
        { name: "Draft", value: "D" },
      ],
    },
    {
      type: FieldType.Compound,
      field: "owner",
      children: [{ type: FieldType.String, field: "name" }],
    } as SchemaField,
  ];

  const sclient = schemaClientSearch<SRow>(sfields, defaultSchemaInterface);

  const srows: SRow[] = [
    { points: 10, status: "S", owner: { name: "Ava" } },
    { points: 2, status: "D", owner: { name: "Liam" } },
    { points: 9, status: "S", owner: { name: "Mia" } },
  ];

  it("sorts numerically via SchemaInterface.compareValue (not lexically)", () => {
    const { entries } = clientSearchPage(
      srows,
      search({ sort: ["apoints"] }),
      sclient,
    );
    // Numeric: 2, 9, 10. Lexical string sort would give 10, 2, 9.
    expect(entries.map((r) => r.points)).toEqual([2, 9, 10]);
  });

  it("filters by a nested field path", () => {
    const { entries, total } = clientSearchPage(
      srows,
      search({ filters: { "owner/name": ["Mia"] } }),
      sclient,
    );
    expect(total).toBe(1);
    expect(entries.map((r) => r.points)).toEqual([9]);
  });

  it("builds search text from option names + scalar fields, skipping compounds", () => {
    // status "S" resolves to option name "Submitted"; owner (compound) is
    // excluded; everything lowercased.
    expect(sclient.getSearchText(srows[0])).toBe("10 submitted");
  });

  it("query search matches the resolved option-name text", () => {
    const { entries, total } = clientSearchPage(
      srows,
      search({ query: "draft" }),
      sclient,
    );
    expect(total).toBe(1);
    expect(entries.map((r) => r.owner.name)).toEqual(["Liam"]);
  });
});
