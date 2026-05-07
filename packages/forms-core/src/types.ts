import {
  type ControlDefinition,
  ControlDisableType,
  type FieldOption,
  type SchemaField,
} from "./json";
import type { Control, ReadContext } from "@rxc/controls-core";
import type { SchemaInterface } from "./schemaInterface";

export interface CleanupScope {
  addCleanup(cleanup: () => void): void;
}

/**
 * Producer of context variables exposed to expression evaluators
 * (jsonata, etc.). Receives the consumer's {@link ReadContext} so any
 * reactive reads it performs (e.g. `rc.getValue(control)` to expose a
 * live derived value) re-trigger the consumer when their inputs change.
 *
 * The returned record is bound at evaluation time — values may close over
 * the rc and re-read on subsequent invocations of the same producer.
 */
export type VariablesFunc = (rc: ReadContext) => Record<string, any>;

export interface FormNodeOptions {
  forceReadonly?: boolean;
  forceDisabled?: boolean;
  forceHidden?: boolean;
  variables?: VariablesFunc;
}

/**
 * Resolves the list of child specs for a given form state node.
 *
 * Receives a {@link ReadContext} so it can reactively depend on form state
 * (via `node.getState(rc)`) and on data (via cursors) — the enclosing
 * children-init effect will re-run whenever any read dependency changes.
 */
export type ChildResolverFunc = (
  node: FormStateNode,
  rc: ReadContext,
) => ChildNodeSpec[];

export interface ChildNodeSpec {
  childKey: string | number;
  create: (scope: CleanupScope, meta: Record<string, any>) => ChildNodeInit;
}

export interface ChildNodeInit {
  definition?: ControlDefinition;
  parent?: DataNode;
  node?: FormNode | null;
  variables?: VariablesFunc;
  resolveChildren?: ChildResolverFunc;
}

export interface FormGlobalOptions {
  /**
   * Schema-aware operations (options, emptiness, value comparison).
   * Defaults to the shared `defaultSchemaInterface` when omitted.
   */
  schemaInterface?: SchemaInterface;
  /**
   * Stubbed — expression evaluation (Phase 3c) lands in Layer 4.
   */
  evalExpression?: unknown;
  resolveChildren: ChildResolverFunc;
  runAsync: (af: () => void) => void;
  clearHidden: boolean;
  /**
   * Extra `SchemaField` entries to append when the scripted-proxy walker
   * descends into the `renderOptions` compound. Plugin authors register
   * scriptable options for custom render types (e.g. `maxStars`); the
   * renderer (`@rxc/forms`) collects these from the registry's plugins
   * and passes them through here.
   */
  extraRenderOptionFields?: SchemaField[];
}

export interface FormNodeUi {
  ensureVisible(): void;
  ensureChildVisible(childIndex: number): void;
  getDisabler(type: ControlDisableType): () => () => void;
}

export interface FormStateNode {
  uniqueId: string;
  childKey: string | number;
  parentNode: FormStateNode | undefined;
  /**
   * The form definition node this state tracks. `null`/`undefined` for
   * nodes that were synthesized (e.g. option groups, array element wrappers).
   */
  form: FormNode | null | undefined;
  /**
   * The starting {@link DataNode} for this state node's data context — the
   * node against which the definition's field path is resolved. Stable
   * across the lifetime of this state node.
   */
  parent: DataNode;
  /**
   * Schema-aware operations shared with children. Always populated — either
   * the instance supplied via {@link FormGlobalOptions.schemaInterface} or
   * the shared `defaultSchemaInterface` fallback.
   */
  schemaInterface: SchemaInterface;
  getState(rc: ReadContext): FormState;
  getChildren(rc: ReadContext): FormStateNode[];
  setTouched(b: boolean, notChildren?: boolean): void;
  validate(): boolean;
  ensureMeta<A>(key: string, init: (scope: CleanupScope) => A): A;
  cleanup(): void;
  ui: FormNodeUi;
  attachUi(f: FormNodeUi): void;
  setBusy(busy: boolean): void;
  setForceDisabled(forceDisable: boolean): void;
  /**
   * Acquire a disabler hold scoped per {@link ControlDisableType}. The
   * returned function releases the hold; multiple concurrent holds
   * compose via an internal counter so callers can't stomp on each
   * other. While any hold is active, the targeted node (and via the
   * disabled cascade, all its descendants) is forced disabled.
   *
   * - `Self`: hold targets this node only.
   * - `Form` / `Global`: hold walks to the root of the form state tree
   *   and targets that. (`Global` currently behaves like `Form`; a
   *   process-level registry can be wired in later without changing
   *   the call site.)
   * - `None`: hold is a no-op; the returned release function does
   *   nothing.
   */
  acquireDisabler(type: ControlDisableType): () => void;
}

export interface FormState extends FormNodeOptions {
  /**
   * The resolved {@link DataNode} this state binds to, or `undefined` if the
   * definition does not bind to data. Derived reactively from the starting
   * {@link FormStateNode.parent} and the (scripted-proxy aware) definition's
   * field path.
   */
  dataNode?: DataNode;
  data?: Control<unknown>;
  field?: SchemaField;
  readonly: boolean;
  visible: boolean | null;
  disabled: boolean;
  fieldOptions?: FieldOption[];
  childIndex: number;
  busy: boolean;
  definition: ControlDefinition;
  valid: boolean;
  touched: boolean;
  clearHidden: boolean;
  variables?: VariablesFunc;
  meta: Record<string, any>;
}

/**
 * A persistent handle to a single {@link SchemaField} within a schema tree.
 *
 * A `SchemaNode` is identified by its {@link SchemaNode.id | id} and can be
 * stored in a {@link Control} or any other long-lived structure. It does not
 * hold resolved tree state itself — call {@link SchemaNode.cursor | cursor(rd)}
 * to obtain an ephemeral {@link SchemaCursor} that exposes the field and its
 * children at read time.
 *
 * In an editor scenario the backing data may be a `Control<SchemaField[]>`,
 * so the same node can yield different cursor snapshots as the underlying
 * schema is edited.
 */
export interface SchemaNode {
  /** Stable identifier for this node within its schema tree. */
  id: string;

  /** The parent node, if this is not the root of the schema tree. */
  parent?: SchemaNode;

  /**
   * Resolve this node into an ephemeral {@link SchemaCursor}.
   *
   * The returned cursor is only valid for the duration of the
   * {@link ReadContext} that created it — it registers reactive dependencies
   * so that any consumer reading through it will be notified when the
   * underlying schema changes.
   */
  cursor(rd: ReadContext): SchemaCursor;
}

/**
 * An ephemeral, traversable view of a {@link SchemaNode} at a point in time.
 *
 * Created by {@link SchemaNode.cursor | node.cursor(rd)} and only valid within
 * the {@link ReadContext} that produced it. Provides access to the resolved
 * {@link SchemaField} and the node's children.
 *
 * Only compound fields (fields representing objects) can have children.
 * A compound field may reference another named schema tree, in which case
 * {@link SchemaCursor.children | children} contains the cursors from the
 * referenced tree rather than locally-defined children.
 */
export interface SchemaCursor {
  /** The {@link SchemaNode} this cursor was resolved from. */
  node: SchemaNode;

  /** The {@link SchemaField} at this position in the schema tree. */
  field: SchemaField;

  /**
   * Resolved child cursors. Only present for compound fields.
   * If the compound field references another named schema tree, these are the
   * children of the referenced tree.
   */
  children: SchemaCursor[];

  /** The parent cursor, if this is not the root of the traversal. */
  parent?: SchemaCursor;
  rd: ReadContext;
}

/**
 * A persistent handle to a specific path within a JSON data document, paired
 * with the {@link SchemaField} that describes the data at that location.
 *
 * A `DataNode` is identified by its {@link DataNode.id | id} and can be stored
 * in a {@link Control} or other long-lived structure. Call
 * {@link DataNode.cursor | cursor(rd)} to obtain an ephemeral
 * {@link DataCursor} for reactive traversal of the data tree.
 *
 * Each `DataNode` represents a particular path in the data — e.g. "the `age`
 * field of this person" — and binds the schema metadata for that location to
 * the {@link Control} that holds the actual value.
 */
export interface DataNode {
  /** Stable identifier for this node within its data tree. */
  id: string;

  /** The parent node, if this is not the root of the data tree. */
  parent?: DataNode;

  /**
   * Resolve this node into an ephemeral {@link DataCursor}.
   *
   * The returned cursor is only valid for the duration of the
   * {@link ReadContext} that created it.
   */
  cursor(rd: ReadContext): DataCursor;
}

/**
 * An ephemeral, traversable view of a {@link DataNode} at a point in time.
 *
 * Created by {@link DataNode.cursor | node.cursor(rd)} and only valid within
 * the {@link ReadContext} that produced it. Provides access to the
 * {@link SchemaField} metadata, the {@link Control} holding the actual data
 * value, and navigation methods to traverse into child fields or array
 * elements.
 */
export interface DataCursor {
  /** The {@link DataNode} this cursor was resolved from. */
  node: DataNode;

  /** The {@link SchemaField} describing the data at this location. */
  field: SchemaField;

  /**
   * The {@link SchemaCursor} for this location — gives reactive access to
   * the schema structure (parent, siblings, children). Used by features
   * that need sibling-field navigation (e.g. `onlyForTypes` discrimination
   * via a sibling `isTypeField`) or resolved field lists (e.g. compound
   * children options).
   */
  schema: SchemaCursor;

  /** The {@link Control} holding the actual data value at this path. */
  control: Control<unknown>;

  /**
   * If this cursor represents an element within an array field, the index
   * of that element. `undefined` for non-array positions.
   */
  elementIndex?: number;

  /**
   * Navigate to a child field by name.
   * Returns `undefined` if the field does not exist at this location.
   */
  childField(field: string): DataCursor | undefined;

  /**
   * Navigate to an array element by index.
   * Returns `undefined` if the index is out of bounds.
   */
  childElement(elementIndex: number): DataCursor | undefined;

  /** The parent cursor, if this is not the root of the traversal. */
  parent?: DataCursor;
}

/**
 * A persistent handle to a single {@link ControlDefinition} within a control
 * definition tree.
 *
 * A `FormNode` is identified by its {@link FormNode.id | id} and can be stored
 * in a {@link Control} or other long-lived structure. Call
 * {@link FormNode.cursor | cursor(rd)} to obtain an ephemeral
 * {@link FormCursor} for reactive traversal.
 *
 * `FormNode` represents the structural definition of a form control (layout,
 * bindings, configuration) — not runtime state like visibility or disabled
 * status. Runtime form state is managed by {@link FormStateNode}.
 */
export interface FormNode {
  /** Stable identifier for this node within its control definition tree. */
  id: string;

  /** The parent node, if this is not the root of the control definition tree. */
  parent?: FormNode;

  /**
   * Resolve this node into an ephemeral {@link FormCursor}.
   *
   * The returned cursor is only valid for the duration of the
   * {@link ReadContext} that created it.
   */
  cursor(rd: ReadContext): FormCursor;
  tree: FormTree;
}

/**
 * An ephemeral, traversable view of a {@link FormNode} at a point in time.
 *
 * Created by {@link FormNode.cursor | node.cursor(rd)} and only valid within
 * the {@link ReadContext} that produced it. Provides access to the
 * {@link ControlDefinition} and the resolved child definitions.
 *
 * A `ControlDefinition` can have its children resolved from a locally-defined
 * list or by referencing another named control tree. In either case,
 * {@link FormCursor.children | children} contains the fully resolved child
 * cursors.
 */
export interface FormCursor {
  /** The {@link FormNode} this cursor was resolved from. */
  node: FormNode;

  /** The {@link ControlDefinition} at this position in the control tree. */
  definition: ControlDefinition;

  /**
   * Resolved child cursors. Children may come from the definition's local
   * children or from a referenced control tree.
   */
  children: FormCursor[];

  /** The parent cursor, if this is not the root of the traversal. */
  parent?: FormCursor;
  rd: ReadContext;
}

export interface FormTree {
  readonly rootNode: FormNode;
  createChildCursors(
    localId: string | undefined,
    parent: FormCursor,
  ): FormCursor[];
  resolver: FormTreeResolver;
}

export interface FormTreeResolver {
  getFormTree(formId: string): FormTree | undefined;
}

export interface SchemaTree {
  readonly rootNode: SchemaNode;
  createChildCursors(parent: SchemaCursor): SchemaCursor[];
}

export interface SchemaTreeResolver {
  getSchemaTree(schemaRef: string): SchemaTree | undefined;
}
