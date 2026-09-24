import type { Control, ReadContext } from "@rx-controls/core";
import type { SchemaField } from "./json.js";

/** One step of the path from the root data to a scope, for the jsonata prefix. */
export interface PathSegment {
  key: string | number;
  /** The field at this step is a collection: a null here reads as `[]`, not `{}`. */
  collection: boolean;
}

/**
 * Where a definition sits in the data — the loader's cursor.
 *
 * A translator holds a `Control`, and a `Control` alone cannot answer two
 * things the format asks of it: `../x` needs a parent, and a jsonata
 * expression inside an array row needs the path from the root
 * (`pets#$i[2]`) so that `$$` is the form's root and `$i` the row index, as
 * legacy evaluates them. So the loader threads this alongside the control.
 *
 * **Loader-only.** Nothing here reaches a boundary: a definition's `field`
 * becomes a `Control<T>` at translation, and an expression closes over what
 * it needs. That is the answer to whether v2 needs a cursor — it does, and it
 * lives entirely on the JSON side (README finding 52).
 */
export interface DataScope {
  control: Control<unknown>;
  fields: SchemaField[];
  /** The schema field whose value this is — absent at the root. */
  field?: SchemaField;
  /** Where `..` goes. For a row, the scope that holds the array. */
  parent?: DataScope;
  path: PathSegment[];
  /**
   * Jsonata bindings beyond the data — legacy's `variables`: a radio's
   * per-option children see `$formData.option` and `$formData.optionSelected`.
   * A function of the evaluator's `rc`, so a binding that reads a control
   * re-runs the expression when it changes.
   */
  variables?: (rc: ReadContext) => Record<string, unknown>;
  /**
   * Disambiguates the per-control expression cache. Two options' children
   * share a control *and* an expression and differ only in bindings, so
   * without this the second option would read the first one's result.
   */
  cacheKey?: string;
}

/** The same place in the data, with more bindings. */
export function withVariables(
  scope: DataScope,
  vars: (rc: ReadContext) => Record<string, unknown>,
  key: string,
): DataScope {
  const outer = scope.variables;
  return {
    ...scope,
    variables: outer ? (rc) => ({ ...outer(rc), ...vars(rc) }) : vars,
    cacheKey: `${scope.cacheKey ?? ""}/${key}`,
  };
}

export function rootScope(
  control: Control<unknown>,
  fields: SchemaField[],
): DataScope {
  return { control, fields, path: [] };
}

function fieldControl(
  control: Control<unknown>,
  name: string,
): Control<unknown> {
  return (control as Control<Record<string, unknown>>).fields[
    name
  ] as Control<unknown>;
}

/** Into a compound field's value. */
export function fieldScope(
  scope: DataScope,
  name: string,
  schema: SchemaField | undefined,
): DataScope {
  return {
    control: fieldControl(scope.control, name),
    fields: schema?.children ?? [],
    field: schema,
    parent: scope,
    path: [...scope.path, { key: name, collection: !!schema?.collection }],
    variables: scope.variables,
    cacheKey: scope.cacheKey,
  };
}

/**
 * Into one element of a collection. Two levels, as legacy's data nodes have
 * them: the array itself, then the row — so from a row `..` is the array (a
 * scope with no named fields) and `../..` the scope that holds it, which is
 * what the corpus's one such reference (`../../selectedMessages`) means.
 */
export function elementScope(
  scope: DataScope,
  name: string,
  schema: SchemaField | undefined,
  item: Control<unknown>,
  index: number,
): DataScope {
  const array: DataScope = {
    control: fieldControl(scope.control, name),
    fields: [],
    field: schema,
    parent: scope,
    path: [...scope.path, { key: name, collection: true }],
    variables: scope.variables,
  };
  return {
    control: item,
    fields: schema?.children ?? [],
    field: schema,
    parent: array,
    path: [...array.path, { key: index, collection: true }],
    variables: scope.variables,
  };
}

export function rootOf(scope: DataScope): DataScope {
  let s = scope;
  while (s.parent) s = s.parent;
  return s;
}

export interface ResolvedRef {
  control: Control<unknown>;
  schema?: SchemaField;
  /** The scope the field lives in — its parent data. */
  scope: DataScope;
  name: string;
  /** The scope *of* the field's value — where its children bind. */
  into: DataScope;
}

/**
 * A `/`-separated field reference, legacy's `dataRef`: `a/b` navigates into
 * compound `a`, `..` to the parent scope, `.` is the scope itself (a group
 * re-binding its own data). `undefined` when it walks off the root or ends
 * on `..`.
 */
export function resolveRef(
  scope: DataScope,
  ref: string,
): ResolvedRef | undefined {
  const segs = ref.split("/");
  let cur: DataScope | undefined = scope;
  let last: ResolvedRef | undefined;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    if (!cur) return undefined;
    if (seg === ".") {
      last = {
        control: cur.control,
        schema: cur.field,
        scope: cur.parent ?? cur,
        name: cur.field?.field ?? ".",
        into: cur,
      };
      continue;
    }
    if (seg === "..") {
      cur = cur.parent;
      last = undefined;
      continue;
    }
    const schema = cur.fields.find((f) => f.field === seg);
    const into = fieldScope(cur, seg, schema);
    last = { control: into.control, schema, scope: cur, name: seg, into };
    if (i < segs.length - 1) cur = into;
  }
  return last;
}

/**
 * Jsonata's spelling of a path — `a.b` for fields, `#$i[2]` for an index —
 * legacy's `jsonPathString` with its index syntax, so `$i` is bound the same
 * way.
 */
export function jsonataPrefix(path: PathSegment[]): string {
  let out = "";
  path.forEach((s, i) => {
    if (typeof s.key === "number") out += `#$i[${s.key}]`;
    else {
      if (i > 0) out += ".";
      out += s.key;
    }
  });
  return out;
}

/**
 * Jsonata cannot step through a null compound (jsonata issue #773), so along
 * the known path a null reads as an empty object or array. Legacy's
 * `ensurePathNavigable`, unchanged.
 */
export function ensurePathNavigable(
  data: unknown,
  path: PathSegment[],
): unknown {
  if (path.length === 0 || data == null || typeof data !== "object")
    return data;
  const { key, collection } = path[0];
  const segment = String(key);
  const rest = path.slice(1);
  return new Proxy(data as object, {
    get(target, p, receiver) {
      const val = Reflect.get(target, p, receiver);
      if (typeof p === "string" && p === segment) {
        if (val == null) return ensurePathNavigable(collection ? [] : {}, rest);
        return ensurePathNavigable(val, rest);
      }
      return val;
    },
  });
}
