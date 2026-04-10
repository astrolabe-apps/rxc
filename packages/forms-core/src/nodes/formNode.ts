import type { Control, ReadContext } from "@rxc/controls-core";
import type { ControlDefinition } from "../json";
import type { FormNode, FormCursor } from "../types";

// ── Resolver type ──────────────────────────────────────────────────

export type FormTreeResolver = (formId: string) => FormNode | undefined;

// ── Wrapper node for re-parenting ──────────────────────────────────

function wrapResolvedFormCursor(
  originalCursor: FormCursor,
  parentCursor: FormCursor,
  parentNode: FormNode,
  childSegment: string,
): FormCursor {
  const wrapperNode: FormNode = {
    id: `${parentNode.id}/${childSegment}`,
    parent: parentNode,
    cursor(rd: ReadContext): FormCursor {
      const original = originalCursor.node.cursor(rd);
      return wrapFormCursorWithParent(original, parentCursor, wrapperNode);
    },
  };
  const wrappedCursor: FormCursor = wrapFormCursorWithParent(
    originalCursor,
    parentCursor,
    wrapperNode,
  );
  return wrappedCursor;
}

function wrapFormCursorWithParent(
  original: FormCursor,
  parentCursor: FormCursor,
  wrapperNode: FormNode,
): FormCursor {
  const cursor: FormCursor = {
    node: wrapperNode,
    field: original.field,
    parent: parentCursor,
    get children(): FormCursor[] {
      return original.children.map((child, i) =>
        wrapResolvedFormCursor(child, cursor, wrapperNode, String(i)),
      );
    },
  };
  return cursor;
}

// ── childRefId parsing ─────────────────────────────────────────────

interface ParsedChildRef {
  kind: "local" | "externalRoot" | "externalLocal";
  formId?: string;
  localId?: string;
}

function parseChildRefId(childRefId: string): ParsedChildRef {
  if (!childRefId.startsWith("/")) {
    return { kind: "local", localId: childRefId };
  }
  const parts = childRefId.substring(1).split("/");
  if (parts.length === 1) {
    return { kind: "externalRoot", formId: parts[0] };
  }
  return { kind: "externalLocal", formId: parts[0], localId: parts[1] };
}

// ── Local id lookup (recursive scan) ───────────────────────────────

function findByIdInStaticDefs(
  defs: ControlDefinition[],
  targetId: string,
): ControlDefinition | undefined {
  for (const def of defs) {
    if (def.id === targetId) return def;
    if (def.children) {
      const found = findByIdInStaticDefs(def.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
}

function findNodeByIdInFormTree(
  rootNode: FormNode,
  targetId: string,
  rd: ReadContext,
): FormCursor | undefined {
  const rootCursor = rootNode.cursor(rd);
  return searchFormCursor(rootCursor, targetId);
}

function searchFormCursor(
  cursor: FormCursor,
  targetId: string,
): FormCursor | undefined {
  if (cursor.field.id === targetId) return cursor;
  for (const child of cursor.children) {
    const found = searchFormCursor(child, targetId);
    if (found) return found;
  }
  return undefined;
}

// ── Resolve childRefId children ────────────────────────────────────

function resolveChildRefChildren(
  childRefId: string,
  rootNode: FormNode,
  currentCursor: FormCursor,
  currentNode: FormNode,
  resolver: FormTreeResolver | undefined,
  rd: ReadContext,
): FormCursor[] {
  const parsed = parseChildRefId(childRefId);

  switch (parsed.kind) {
    case "local": {
      const found = findNodeByIdInFormTree(rootNode, parsed.localId!, rd);
      if (!found) return [];
      return found.children.map((c, i) =>
        wrapResolvedFormCursor(c, currentCursor, currentNode, String(i)),
      );
    }
    case "externalRoot": {
      if (!resolver) return [];
      const resolved = resolver(parsed.formId!);
      if (!resolved) return [];
      return resolved.cursor(rd).children.map((c, i) =>
        wrapResolvedFormCursor(c, currentCursor, currentNode, String(i)),
      );
    }
    case "externalLocal": {
      if (!resolver) return [];
      const resolved = resolver(parsed.formId!);
      if (!resolved) return [];
      const found = findNodeByIdInFormTree(resolved, parsed.localId!, rd);
      if (!found) return [];
      return found.children.map((c, i) =>
        wrapResolvedFormCursor(c, currentCursor, currentNode, String(i)),
      );
    }
  }
}

// ── Static form tree ───────────────────────────────────────────────

export function createStaticFormTree(
  definitions: ControlDefinition[],
  resolver?: FormTreeResolver,
): FormNode {
  let memoizedCursor: FormCursor | undefined;

  const rootDef: ControlDefinition = {
    type: "Group",
    children: definitions,
  };

  const rootNode: FormNode = {
    id: "$root",
    cursor(_rd: ReadContext): FormCursor {
      if (!memoizedCursor) {
        const cursor: FormCursor = {
          node: rootNode,
          field: rootDef,
          get children(): FormCursor[] {
            return makeStaticChildCursors(
              definitions,
              rootNode,
              cursor,
              rootNode,
              resolver,
            );
          },
        };
        memoizedCursor = cursor;
      }
      return memoizedCursor;
    },
  };
  return rootNode;
}

function makeStaticChildCursors(
  definitions: ControlDefinition[],
  parentNode: FormNode,
  parentCursor: FormCursor,
  rootNode: FormNode,
  resolver: FormTreeResolver | undefined,
): FormCursor[] {
  return definitions.map((def, index) => {
    const childNode: FormNode = {
      id: `${parentNode.id}/${index}`,
      parent: parentNode,
      cursor(_rd: ReadContext): FormCursor {
        return childCursor;
      },
    };
    const childCursor: FormCursor = {
      node: childNode,
      field: def,
      parent: parentCursor,
      get children(): FormCursor[] {
        if (def.childRefId) {
          return resolveChildRefChildren(
            def.childRefId,
            rootNode,
            childCursor,
            childNode,
            resolver,
            _noop,
          );
        }
        if (def.children) {
          return makeStaticChildCursors(
            def.children,
            childNode,
            childCursor,
            rootNode,
            resolver,
          );
        }
        return [];
      },
    };
    return childCursor;
  });
}

const _noop: ReadContext = null as unknown as ReadContext;

// ── Reactive form tree ─────────────────────────────────────────────

export function createReactiveFormTree(
  definitionsControl: Control<ControlDefinition[]>,
  resolver?: FormTreeResolver,
): FormNode {
  const rootDef: ControlDefinition = {
    type: "Group",
  };

  const rootNode: FormNode = {
    id: "$root",
    cursor(rd: ReadContext): FormCursor {
      const elements = rd.getElements(definitionsControl);
      const cursor: FormCursor = {
        node: rootNode,
        field: rootDef,
        get children(): FormCursor[] {
          return elements.map((elemControl, _index) =>
            makeReactiveFormChildCursor(
              elemControl,
              rootNode,
              cursor,
              rootNode,
              rd,
              resolver,
            ),
          );
        },
      };
      return cursor;
    },
  };
  return rootNode;
}

function makeReactiveFormChildCursor(
  elemControl: Control<ControlDefinition>,
  parentNode: FormNode,
  parentCursor: FormCursor,
  rootNode: FormNode,
  rd: ReadContext,
  resolver: FormTreeResolver | undefined,
): FormCursor {
  const childNode: FormNode = {
    id: `${parentNode.id}/${elemControl.uniqueId}`,
    parent: parentNode,
    cursor(rd2: ReadContext): FormCursor {
      return makeReactiveFormChildCursor(
        elemControl,
        parentNode,
        parentCursor,
        rootNode,
        rd2,
        resolver,
      );
    },
  };

  const def = rd.getValueRx(elemControl);

  const childCursor: FormCursor = {
    node: childNode,
    field: def,
    parent: parentCursor,
    get children(): FormCursor[] {
      if (def.childRefId) {
        return resolveChildRefChildren(
          def.childRefId,
          rootNode,
          childCursor,
          childNode,
          resolver,
          rd,
        );
      }
      const childrenControl = (
        elemControl as unknown as Control<Record<string, unknown>>
      ).fields["children"] as unknown as Control<ControlDefinition[]>;
      if (!childrenControl || rd.isNull(childrenControl)) return [];
      const childElements = rd.getElements(childrenControl);
      return childElements.map((ce) =>
        makeReactiveFormChildCursor(
          ce,
          childNode,
          childCursor,
          rootNode,
          rd,
          resolver,
        ),
      );
    },
  };
  return childCursor;
}

// ── Resolver factories ─────────────────────────────────────────────

export function createStaticFormResolver(
  allDefs: Record<string, ControlDefinition[]>,
): FormTreeResolver {
  const cache = new Map<string, FormNode>();
  const resolver: FormTreeResolver = (formId: string) => {
    let node = cache.get(formId);
    if (!node) {
      const defs = allDefs[formId];
      if (!defs) return undefined;
      node = createStaticFormTree(defs, resolver);
      cache.set(formId, node);
    }
    return node;
  };
  return resolver;
}

export function createReactiveFormResolver(
  allDefs: Control<Record<string, ControlDefinition[]>>,
): FormTreeResolver {
  const cache = new Map<string, FormNode>();
  const resolver: FormTreeResolver = (formId: string) => {
    let node = cache.get(formId);
    if (!node) {
      const control = (allDefs as Control<Record<string, unknown>>).fields[
        formId
      ] as unknown as Control<ControlDefinition[]>;
      node = createReactiveFormTree(control, resolver);
      cache.set(formId, node);
    }
    return node;
  };
  return resolver;
}
