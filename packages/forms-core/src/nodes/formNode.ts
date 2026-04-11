import type { Control, ReadContext } from "@rxc/controls-core";
import type { ControlDefinition } from "../json";
import type { FormNode, FormCursor } from "../types";

// ── Resolver type ──────────────────────────────────────────────────

/**
 * Resolves a form identifier to the {@link FormNode} root of that form's
 * control definition tree. Used by `childRefId` references to inline another
 * form tree's children (or a specific node within it) in place of local children.
 *
 * Returns `undefined` when the form cannot be resolved.
 */
export type FormTreeResolver = (formId: string) => FormNode | undefined;

// ── Wrapper node for re-parenting ──────────────────────────────────

/**
 * Wraps a cursor from a resolved `childRefId` tree so that it appears as a
 * child of the referencing node. Creates a new {@link FormNode} with a
 * path-based id under `parentNode` and re-parents the cursor's `parent`
 * pointer to `parentCursor`.
 */
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

/**
 * Creates a shallow copy of `original` with its `parent` and `node` replaced,
 * recursively wrapping descendant cursors so the sub-tree is re-parented under
 * `wrapperNode`.
 */
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

/**
 * Internal representation of a parsed `childRefId` string.
 *
 * Formats:
 * - `"localId"`       → `local`         — children of a node in the same tree
 * - `"/formId"`       → `externalRoot`  — root children of an external form tree
 * - `"/formId/nodeId"` → `externalLocal` — children of a specific node in an external tree
 */
interface ParsedChildRef {
  kind: "local" | "externalRoot" | "externalLocal";
  formId?: string;
  localId?: string;
}

/** Parses a `childRefId` string into its structured components. */
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

/**
 * Recursively searches a form tree for a node whose `ControlDefinition.id`
 * matches `targetId`. Skips subtrees rooted at `childRefId` nodes to avoid
 * infinite recursion when trees cross-reference each other.
 */
function findNodeByIdInFormTree(
  rootNode: FormNode,
  targetId: string,
  rd: ReadContext,
): FormCursor | undefined {
  const rootCursor = rootNode.cursor(rd);
  return searchFormCursor(rootCursor, targetId);
}

/** Depth-first search helper for {@link findNodeByIdInFormTree}. */
function searchFormCursor(
  cursor: FormCursor,
  targetId: string,
): FormCursor | undefined {
  if (cursor.field.id === targetId) return cursor;
  // Don't recurse into childRefId-resolved children — they belong to another
  // tree and would cause infinite recursion during local id lookup.
  if (cursor.field.childRefId) return undefined;
  for (const child of cursor.children) {
    const found = searchFormCursor(child, targetId);
    if (found) return found;
  }
  return undefined;
}

// ── Resolve childRefId children ────────────────────────────────────

/**
 * Resolves the children for a node whose `ControlDefinition` has a `childRefId`.
 *
 * Depending on the parsed reference kind:
 * - **local**: finds a node by id within the same tree and returns its children.
 * - **externalRoot**: resolves an external form tree and returns its root children.
 * - **externalLocal**: resolves an external tree, then finds a specific node within it.
 *
 * All resolved children are re-parented under `currentNode`/`currentCursor`.
 */
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

/**
 * Creates a {@link FormNode} root from a plain array of {@link ControlDefinition}s.
 *
 * The resulting tree is non-reactive — cursors are built once and memoized.
 * Use this when the form layout is known at build time and will not change.
 *
 * @param definitions - The top-level control definitions.
 * @param resolver    - Optional resolver for `childRefId` references.
 * @returns The root {@link FormNode} of the static form tree.
 */
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
    cursor(rd: ReadContext): FormCursor {
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
              rd,
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

/**
 * Builds child {@link FormCursor}s for a list of static {@link ControlDefinition}s.
 * Handles `childRefId` resolution and recursive descent into `children` arrays.
 */
function makeStaticChildCursors(
  definitions: ControlDefinition[],
  parentNode: FormNode,
  parentCursor: FormCursor,
  rootNode: FormNode,
  resolver: FormTreeResolver | undefined,
  rd: ReadContext,
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
            rd,
          );
        }
        if (def.children) {
          return makeStaticChildCursors(
            def.children,
            childNode,
            childCursor,
            rootNode,
            resolver,
            rd,
          );
        }
        return [];
      },
    };
    return childCursor;
  });
}

// ── Reactive form tree ─────────────────────────────────────────────

/**
 * Creates a {@link FormNode} root backed by a reactive
 * `Control<ControlDefinition[]>`.
 *
 * Each call to `cursor(rd)` reads the current elements of
 * `definitionsControl` through the {@link ReadContext}, so the tree structure
 * updates automatically when the underlying control changes. Use this in
 * editor scenarios where the form layout is being edited by the user.
 *
 * @param definitionsControl - A reactive control holding the top-level definitions.
 * @param resolver           - Optional resolver for `childRefId` references.
 * @returns The root {@link FormNode} of the reactive form tree.
 */
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

/**
 * Builds a single reactive child {@link FormCursor} from a
 * `Control<ControlDefinition>`.
 *
 * The definition value is read reactively via `rd.getValueRx()`, and children
 * are resolved by reading the control's `children` sub-control as an element
 * list. Handles `childRefId` resolution for cross-tree references.
 * Node ids incorporate the control's `uniqueId` for stability.
 */
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

/**
 * Creates a {@link FormTreeResolver} from a plain record of named control
 * definition arrays. Resolved trees are cached so each form id is built once.
 *
 * @param allDefs - A map from form id to its control definitions.
 */
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

/**
 * Creates a {@link FormTreeResolver} backed by a reactive
 * `Control<Record<string, ControlDefinition[]>>`. Each form id is resolved
 * to a reactive tree via {@link createReactiveFormTree} and cached.
 *
 * @param allDefs - A reactive control holding all named form definitions.
 */
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
