import { describe, it, expect } from "vitest";
import { clientSearchPage, fieldClientSearch } from "../src/clientSearch";
import type { SearchOptions } from "@astroapps/searchstate";

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
