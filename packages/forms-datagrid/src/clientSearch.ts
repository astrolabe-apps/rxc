import {
  type ClientSideSearching,
  type SearchOptions,
  getPageOfResults,
  makeClientSortAndFilter,
} from "@astroapps/searchstate";

/**
 * Default {@link ClientSideSearching} for plain object rows keyed by field
 * name: filter values and sort comparisons read `row[field]` directly, and
 * query search is a no-op. Suitable when a DataGrid's columns bind to
 * top-level scalar fields of each row. Hosts with nested fields, custom
 * comparisons, or full-text query search should supply their own.
 */
export function fieldClientSearch<
  T extends Record<string, unknown>,
>(): ClientSideSearching<T> {
  return {
    getSearchText: () => "",
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

/**
 * Apply a {@link SearchOptions} state (filters + sort + offset/length) to a
 * full row set, returning the current page plus the post-filter total. This
 * is the client-side equivalent of what a server would compute from the
 * search request — wire it in a reactive effect to keep a grid's bound
 * `{ total, entries }` results in sync with the search control.
 */
export function clientSearchPage<T>(
  allRows: T[],
  search: SearchOptions,
  client: ClientSideSearching<T>,
): { entries: T[]; total: number } {
  const filtered = makeClientSortAndFilter(client)(search, allRows);
  const length = search.length ?? filtered.length;
  const entries = getPageOfResults(search.offset ?? 0, length, filtered);
  return { entries, total: filtered.length };
}
