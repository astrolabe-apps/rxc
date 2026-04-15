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

/**
 * Navigate a data cursor through a path of field names. Supports two
 * special segments mirroring the old `schemaDataForFieldPath` semantics:
 *
 * - `".."` — move to the parent cursor (returns `undefined` at the root).
 * - `"."`  — no-op, stay on the current cursor.
 *
 * Any other segment is looked up as a named child field.
 */
export function dataPath(
  cursor: DataCursor,
  path: string[],
): DataCursor | undefined {
  let current: DataCursor | undefined = cursor;
  for (const segment of path) {
    if (!current) return undefined;
    if (segment === ".") continue;
    if (segment === "..") {
      current = current.parent;
      continue;
    }
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

/**
 * Whether a {@link DataCursor} is currently "valid" according to the
 * `onlyForTypes` schema rule.
 *
 * A field may declare `onlyForTypes: string[]` meaning it is only present
 * when the parent object's type-discriminator field (the sibling marked
 * `isTypeField: true`) holds one of the listed values. When the current
 * discriminator doesn't match, `validDataCursor` returns `false` and the
 * form state uses that to hide the node (step 3 of the Visible rule).
 *
 * The walk also recurses through array parents (when `elementIndex == null`
 * — i.e. the array as a whole, not a specific element) since their validity
 * depends on their own parent's discriminator.
 *
 * Returns `true` when there is no constraint to check (no parent, no
 * `onlyForTypes`, or no type-field sibling).
 */
export function validDataCursor(cursor: DataCursor): boolean {
  const parent = cursor.parent;
  if (!parent) return true;
  if (parent.field.collection && parent.elementIndex == null)
    return validDataCursor(parent);
  if (!validDataCursor(parent)) return false;
  const types = cursor.field.onlyForTypes;
  if (types == null || types.length === 0) return true;
  const typeSchema = parent.schema.children.find((c) => c.field.isTypeField);
  if (!typeSchema) return false;
  const typeChild = parent.childField(typeSchema.field.field);
  if (!typeChild) return false;
  // Route through the cursor's ReadContext so callers running inside a
  // computed/effect track the discriminator value reactively.
  const rd = cursor.schema.rd;
  const typeValue = rd.getValue(typeChild.control);
  return typeof typeValue === "string" && types.includes(typeValue);
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
