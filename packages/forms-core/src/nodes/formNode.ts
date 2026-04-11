import {
  type Control,
  type ReadContext,
  unwrapValueProxy,
} from "@rxc/controls-core";
import {
  type ControlDefinition,
  ControlDefinitionType,
  isCompoundField,
  type SchemaField,
} from "../json";
import type {
  FormNode,
  FormCursor,
  FormTreeResolver,
  FormTree,
  SchemaNode,
  SchemaTreeResolver,
  SchemaTree,
} from "../types";

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
  resolver: FormTreeResolver,
): FormTree {
  return new StaticFormTree(definitions, resolver);
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
  resolver: FormTreeResolver,
): FormTree {
  return new ReactiveFormTree(definitionsControl, resolver);
}

function addToIdMap(
  controls: ControlDefinition[],
  idMap: Map<string, ControlDefinition>,
) {
  controls.forEach((x, i) => {
    if (x.id) idMap.set(x.id, x);
    if (x.children) addToIdMap(x.children, idMap);
  });
}

class StaticFormTree implements FormTree {
  readonly rootNode: FormNode;
  idMap: Map<string, ControlDefinition> = new Map();

  constructor(
    private rootControls: ControlDefinition[],
    public resolver: FormTreeResolver,
  ) {
    addToIdMap(rootControls, this.idMap);
    const tree = this;
    const rootNode: FormNode = {
      id: "$root",
      parent: undefined,
      tree,
      cursor(rd: ReadContext): FormCursor {
        return {
          rd,
          node: rootNode,
          field: { type: ControlDefinitionType.Group },
          children: rootControls.map((x, i) =>
            new StaticFormNode(x, i, rootNode, tree).cursor(rd),
          ),
        };
      },
    };
    this.rootNode = rootNode;
  }

  createChildCursors(
    localId: string | undefined,
    parent: FormCursor,
  ): FormCursor[] {
    if (!localId)
      return this.rootControls.map((x, i) =>
        new StaticFormNode(x, i, parent.node, this).cursor(parent.rd),
      );
    const c = this.idMap.get(localId);
    return (
      c?.children?.map((x, i) =>
        new StaticFormNode(x, i, parent.node, this).cursor(parent.rd),
      ) ?? []
    );
  }
}

class StaticFormNode implements FormNode {
  id: string;
  constructor(
    private definition: ControlDefinition,
    childIndex: number,
    public parent: FormNode,
    public tree: FormTree,
  ) {
    this.id = this.parent.id + "/" + childIndex;
  }

  cursor(rd: ReadContext): FormCursor {
    return new FormCursorImpl(this.definition, this, rd);
  }
}

class FormCursorImpl implements FormCursor {
  constructor(
    public field: ControlDefinition,
    public node: FormNode,
    public rd: ReadContext,
  ) {}

  get parent() {
    return this.node.parent?.cursor(this.rd);
  }

  get children(): FormCursor[] {
    const crfId = this.field.childRefId;
    if (crfId) {
      const parsed = parseChildRefId(crfId);
      if (parsed.kind === "local")
        return this.node.tree.createChildCursors(parsed.localId, this);
      return (
        this.node.tree.resolver
          .getFormTree(parsed.formId!)
          ?.createChildCursors(parsed.localId, this) ?? []
      );
    }
    return (
      this.field.children?.map((x, i) =>
        createChildFormNode(this.node, x, i, this.node.tree).cursor(this.rd),
      ) ?? []
    );
  }
}

class ReactiveFormTree implements FormTree {
  readonly rootNode: FormNode;

  constructor(
    private rootControls: Control<ControlDefinition[]>,
    public resolver: FormTreeResolver,
  ) {
    const tree = this;
    const rootNode: FormNode = {
      id: "$root",
      parent: undefined,
      tree,
      cursor(rd: ReadContext): FormCursor {
        return {
          rd,
          node: rootNode,
          field: { type: ControlDefinitionType.Group },
          children: rd
            .getElements(rootControls)
            .map((x) => new ReactiveFormNode(x, rootNode, tree).cursor(rd)),
        };
      },
    };
    this.rootNode = rootNode;
  }

  createChildCursors(
    localId: string | undefined,
    parent: FormCursor,
  ): FormCursor[] {
    const rd = parent.rd;
    if (!localId)
      return rd
        .getElements(this.rootControls)
        .map((x) => new ReactiveFormNode(x, parent.node, this).cursor(rd));
    throw "Not implemented yet - localId on reactive";
  }
}

class ReactiveFormNode implements FormNode {
  id: string;
  constructor(
    private definition: Control<ControlDefinition>,
    public parent: FormNode,
    public tree: FormTree,
  ) {
    this.id = this.parent.id + "/" + definition.uniqueId;
  }

  cursor(rd: ReadContext): FormCursor {
    return new FormCursorImpl(rd.getValueRx(this.definition), this, rd);
  }
}

function createChildFormNode(
  parentNode: FormNode,
  controlOrProxy: ControlDefinition,
  childIndex: number,
  tree: FormTree,
): FormNode {
  const c = unwrapValueProxy(controlOrProxy);
  if (c) throw new ReactiveFormNode(c, parentNode, tree);
  return new StaticFormNode(controlOrProxy, childIndex, parentNode, tree);
}

export type FormTreeFactory = (
  name: string,
  resolver: FormTreeResolver,
) => FormTree | undefined;

class FormTreeResolverImpl implements FormTreeResolver {
  private cache = new Map<string, FormTree>();
  constructor(private factory: FormTreeFactory) {}
  getFormTree(formId: string): FormTree | undefined {
    const cached = this.cache.get(formId);
    if (cached) return cached;
    const tree = this.factory(formId, this);
    if (tree) this.cache.set(formId, tree);
    return tree;
  }
}

export function createFormTreeResolver(factory: FormTreeFactory) {
  return new FormTreeResolverImpl(factory);
}
