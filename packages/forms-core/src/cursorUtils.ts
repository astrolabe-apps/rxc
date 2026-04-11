import type {
  SchemaCursor,
  DataCursor,
  FormCursor,
} from "./types";
import {
  type ControlDefinition,
  ControlDefinitionType,
  type DataControlDefinition,
  type GroupedControlsDefinition,
  isCompoundField,
  isDataControl,
  isGroupControl,
} from "./json";

// ── Schema cursor utils ─────────────────────────────────────────────

/** Find a direct child cursor by field name. */
export function schemaChild(
  cursor: SchemaCursor,
  field: string,
): SchemaCursor | undefined {
  return cursor.children.find((c) => c.field.field === field);
}

/** Navigate a schema cursor through a path of field names. */
export function schemaPath(
  cursor: SchemaCursor,
  path: string[],
): SchemaCursor | undefined {
  let current: SchemaCursor | undefined = cursor;
  for (const segment of path) {
    if (!current) return undefined;
    current = schemaChild(current, segment);
  }
  return current;
}

/**
 * Navigate a schema cursor through a `/`-separated field reference.
 * E.g. `"address/street"` navigates two levels deep.
 */
export function schemaRef(
  cursor: SchemaCursor,
  ref: string,
): SchemaCursor | undefined {
  return schemaPath(cursor, ref.split("/"));
}

/**
 * Collect the {@link SchemaField} at each level from the root down to
 * (and including) this cursor.
 */
export function schemaFieldPath(cursor: SchemaCursor): SchemaCursor[] {
  const path: SchemaCursor[] = [];
  let current: SchemaCursor | undefined = cursor;
  while (current) {
    path.push(current);
    current = current.parent;
  }
  return path.reverse();
}

/**
 * Return the `/`-separated path string from the root to this cursor.
 * E.g. `"address/street"`.
 */
export function schemaPathString(cursor: SchemaCursor): string {
  return schemaFieldPath(cursor)
    .map((c) => c.field.field)
    .join("/");
}

/**
 * Compute a relative path from `parent` to `child`.
 * Uses `".."` segments to walk up from `child` to the common ancestor.
 */
export function schemaRelativePath(
  parent: SchemaCursor,
  child: SchemaCursor,
): string {
  const parentPath = schemaFieldPath(parent).map((c) => c.field.field);
  const childPath = schemaFieldPath(child).map((c) => c.field.field);

  // Find common prefix length
  let common = 0;
  while (
    common < parentPath.length &&
    common < childPath.length &&
    parentPath[common] === childPath[common]
  ) {
    common++;
  }

  const ups = parentPath.length - common;
  const downs = childPath.slice(common);
  const segments = [...Array<string>(ups).fill(".."), ...downs];
  return segments.join("/");
}

/** Check whether a schema cursor's field is a compound (object) field. */
export function isCompoundCursor(cursor: SchemaCursor): boolean {
  return isCompoundField(cursor.field);
}

// ── Data cursor utils ───────────────────────────────────────────────

/** Navigate a data cursor through a path of field names. */
export function dataPath(
  cursor: DataCursor,
  path: string[],
): DataCursor | undefined {
  let current: DataCursor | undefined = cursor;
  for (const segment of path) {
    if (!current) return undefined;
    current = current.childField(segment);
  }
  return current;
}

/**
 * Navigate a data cursor through a `/`-separated field reference.
 * E.g. `"address/street"` navigates two levels deep.
 */
export function dataRef(
  cursor: DataCursor,
  ref: string,
): DataCursor | undefined {
  return dataPath(cursor, ref.split("/"));
}

/** Walk up to the root of the data tree. */
export function dataRoot(cursor: DataCursor): DataCursor {
  let current = cursor;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}

/**
 * Get the JSON path from the root to this cursor as an array of
 * field names and array indices. E.g. `["people", 2, "name"]`.
 */
export function dataJsonPath(cursor: DataCursor): (string | number)[] {
  const path: (string | number)[] = [];
  let current: DataCursor | undefined = cursor;
  while (current) {
    if (current.elementIndex !== undefined) {
      path.push(current.elementIndex);
    }
    path.push(current.field.field);
    current = current.parent;
  }
  return path.reverse();
}

/**
 * Format a JSON path as a string. Field names are separated by `/`,
 * array indices are formatted as `[N]`.
 * E.g. `"people[2]/name"`.
 */
export function dataJsonPathString(cursor: DataCursor): string {
  const parts = dataJsonPath(cursor);
  let result = "";
  for (const part of parts) {
    if (typeof part === "number") {
      result += `[${part}]`;
    } else {
      if (result.length > 0) result += "/";
      result += part;
    }
  }
  return result;
}

// ── Form cursor utils ───────────────────────────────────────────────

/**
 * Depth-first search of a form cursor tree. Returns the first non-undefined
 * result from `fn`, or `undefined` if no match is found.
 */
export function formVisit<A>(
  cursor: FormCursor,
  fn: (c: FormCursor) => A | undefined,
): A | undefined {
  const result = fn(cursor);
  if (result !== undefined) return result;
  for (const child of cursor.children) {
    const childResult = formVisit(child, fn);
    if (childResult !== undefined) return childResult;
  }
  return undefined;
}

/**
 * Extract the field path that a {@link ControlDefinition} binds to.
 *
 * - `Data` controls bind to a single field name.
 * - `Group` controls optionally bind to a `compoundField`.
 *
 * Returns `undefined` for definitions that don't bind to data.
 */
export function formFieldPath(
  def: ControlDefinition,
): string | undefined {
  if (isDataControl(def)) {
    return def.field;
  }
  if (isGroupControl(def)) {
    return def.compoundField ?? undefined;
  }
  return undefined;
}

/**
 * Resolve the {@link DataCursor} that a form cursor's definition binds to,
 * relative to a parent data cursor.
 *
 * Returns `undefined` if the definition doesn't bind to a data field, or if
 * the field doesn't exist in the data tree.
 */
export function formDataCursor(
  cursor: FormCursor,
  parentData: DataCursor,
): DataCursor | undefined {
  const field = formFieldPath(cursor.definition);
  if (field === undefined) return undefined;
  return parentData.childField(field);
}

// ── Generic cursor utils ────────────────────────────────────────────

/**
 * Collect all ancestors of a cursor (including itself), from the cursor
 * up to the root. The cursor itself is first, the root is last.
 */
export function cursorParents<C extends { parent?: C }>(cursor: C): C[] {
  const parents: C[] = [];
  let current: C | undefined = cursor;
  while (current) {
    parents.push(current);
    current = current.parent;
  }
  return parents;
}
