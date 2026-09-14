import {
  type ClientSideSearching,
  type SearchOptions,
  getPageOfResults,
  makeClientSortAndFilter,
} from "@astroapps/searchstate";
import {
  isCompoundField,
  type SchemaField,
  type SchemaInterface,
} from "@rx-controls/forms-core";

export interface FieldClientSearchOptions<T> {
  /**
   * Top-level row field names whose values should be concatenated (space-
   * separated, lowercased) to form the full-text search corpus for each row.
   * When omitted, `getSearchText` returns an empty string and the query box
   * is effectively inert. Hosts that need nested-field or formatted text
   * should supply {@link getSearchText} directly instead.
   */
  searchableFields?: (keyof T & string)[];
  /**
   * Custom row-to-text function, when {@link searchableFields} isn't a good
   * fit. The returned string is matched case-insensitively against the
   * search query — return lowercased text for consistency.
   */
  getSearchText?: (row: T) => string;
}

/**
 * Default {@link ClientSideSearching} for plain object rows keyed by field
 * name: filter values and sort comparisons read `row[field]` directly.
 * `getSearchText` is opt-in via {@link FieldClientSearchOptions.searchableFields}
 * (a list of row fields to include) or {@link FieldClientSearchOptions.getSearchText}
 * (a fully custom builder); with neither, full-text query search is a no-op.
 * Hosts with nested fields or custom comparisons should supply their own
 * {@link ClientSideSearching} instead.
 */
export function fieldClientSearch<T extends Record<string, unknown>>(
  options: FieldClientSearchOptions<T> = {},
): ClientSideSearching<T> {
  const { searchableFields, getSearchText: customGetSearchText } = options;
  const getSearchText =
    customGetSearchText ??
    (searchableFields && searchableFields.length > 0
      ? (row: T) =>
          searchableFields
            .map((f) => {
              const v = row[f];
              return v == null ? "" : String(v);
            })
            .join(" ")
            .toLowerCase()
      : () => "");
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

/**
 * Resolve a `/`-separated field reference against a list of row
 * {@link SchemaField}s, walking into compound children for each segment.
 * Returns the leaf field (for type-aware comparison) and a reader that
 * walks the raw row object along the same path. The leaf field is
 * `undefined` when the path doesn't resolve — callers fall back to
 * "no comparison/filter for this field".
 */
function resolveFieldPath(
  fields: SchemaField[],
  path: string[],
): { field: SchemaField | undefined; read: (row: unknown) => unknown } {
  let currentFields: SchemaField[] | undefined = fields;
  let field: SchemaField | undefined;
  for (const seg of path) {
    field = currentFields?.find((f) => f.field === seg);
    currentFields =
      field && isCompoundField(field) ? field.children : undefined;
  }
  const read = (row: unknown) => {
    let v: unknown = row;
    for (const seg of path) {
      if (v == null || typeof v !== "object") return undefined;
      v = (v as Record<string, unknown>)[seg];
    }
    return v;
  };
  return { field, read };
}

/**
 * Schema-aware {@link ClientSideSearching} for object rows described by a
 * list of {@link SchemaField}s. Unlike {@link fieldClientSearch}, this:
 *
 *  - resolves nested `field/path` references by walking compound children;
 *  - compares values through {@link SchemaInterface.compareValue}, so dates,
 *    numbers, and other typed fields sort correctly (not lexicographically);
 *  - builds full-text search corpus from {@link SchemaInterface.textValue}
 *    over the scalar top-level fields (option `name`s, formatted dates, etc.).
 *
 * Ported from the legacy `schemaNodeClientSideSearch`
 * (`@astroapps/schemas-datagrid`); `textValue` stands in for the legacy
 * `searchText` (rxc's `SchemaInterface` exposes the former). Pass the row
 * element's fields — typically `dataGrid` element schema children — and the
 * active `SchemaInterface`.
 */
export function schemaClientSearch<T extends Record<string, unknown>>(
  fields: SchemaField[],
  schemaInterface: SchemaInterface,
): ClientSideSearching<T> {
  return {
    getSearchText: (row) =>
      fields
        .filter((f) => !f.collection && !isCompoundField(f))
        .map((f) => schemaInterface.textValue(f, row[f.field]) ?? "")
        .join(" ")
        .toLowerCase(),
    getComparison: (field) => {
      const { field: leaf, read } = resolveFieldPath(fields, field.split("/"));
      if (!leaf) return undefined;
      return (a, b) => schemaInterface.compareValue(leaf, read(a), read(b));
    },
    getFilterValue: (field) => {
      const { read } = resolveFieldPath(fields, field.split("/"));
      return (row) => read(row);
    },
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
