import {
  type ControlDefinition,
  ControlDisableType,
  type FieldOption,
  type SchemaField,
} from "./json";
import type {
  ChangeListenerFunc,
  Control,
  ReadContext,
} from "@rxc/controls-core";

export interface CleanupScope {
  addCleanup(cleanup: () => void): void;
}

export type VariablesFunc = (
  changes: ChangeListenerFunc<any>,
) => Record<string, any>;

export interface FormNodeOptions {
  forceReadonly?: boolean;
  forceDisabled?: boolean;
  forceHidden?: boolean;
  variables?: VariablesFunc;
}

export type ChildResolverFunc = (c: FormStateNode) => ChildNodeSpec[];

export interface ChildNodeSpec {
  childKey: string | number;
  create: (scope: CleanupScope, meta: Record<string, any>) => ChildNodeInit;
}

export interface ChildNodeInit {
  definition?: ControlDefinition;
  parent?: SchemaDataNode;
  node?: FormNode | null;
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>;
  resolveChildren?: ChildResolverFunc;
}

export interface FormGlobalOptions {
  // schemaInterface: SchemaInterface;
  // evalExpression: (e: EntityExpression, ctx: ExpressionEvalContext) => void;
  resolveChildren(c: FormStateNode): ChildNodeSpec[];
  runAsync: (af: () => void) => void;
  clearHidden: boolean;
  controlDefinitionSchema?: SchemaNode;
}

export interface ResolvedDefinition {
  definition: ControlDefinition;
  stateId?: string;
  fieldOptions?: FieldOption[];
}

export interface FormStateBase {
  data?: Control<unknown>;
  field?: SchemaField;
  readonly: boolean;
  visible: boolean | null;
  disabled: boolean;
  resolved: ResolvedDefinition;
  childIndex: number;
  busy: boolean;
}

export interface FormNodeUi {
  ensureVisible(): void;
  ensureChildVisible(childIndex: number): void;
  getDisabler(type: ControlDisableType): () => () => void;
}

export interface FormStateNode {
  uniqueId: string;
  parentNode: FormStateNode | undefined;
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
}

export interface FormState extends FormStateBase, FormNodeOptions {
  childKey: string | number;
  definition: ControlDefinition;
  // schemaInterface: SchemaInterface;
  valid: boolean;
  touched: boolean;
  clearHidden: boolean;
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>;
  meta: Record<string, any>;
}

export interface SchemaNode {
  parent?: SchemaNode;
  getField(rc: ReadContext): SchemaField;
  getChildren(rc: ReadContext): SchemaNode[];
  getChildNode(rc: ReadContext, field: string): SchemaNode;
}

export interface SchemaDataNode {
  data: Control<unknown>;
  parent?: SchemaDataNode;
  elementIndex?: number;
  schema: SchemaNode;
  getField(rc: ReadContext): SchemaField;
  getChildren(rc: ReadContext): SchemaDataNode[];
  getChild(rc: ReadContext, field: string): SchemaDataNode;
  getChildElement(elementIndex: number): SchemaDataNode;
}

export interface FormNode {
  id: string;
  definition: ControlDefinition;
  tree: FormTree;
  parent?: FormNode;

  visit<A>(visitFn: (n: FormNode) => A | undefined): A | undefined;

  getResolvedChildren(): ControlDefinition[];

  createChildNode(childId: string, childDef: ControlDefinition): FormNode;

  getChildNodes(): FormNode[];

  getUnresolvedChildNodes(): FormNode[];
}

export interface FormTreeLookup {
  getForm(formId: string): FormTree | undefined;
}

export interface FormTree extends FormTreeLookup {
  rootNode: FormNode;

  getByRefId(id: string): ControlDefinition | undefined;

  getForm(formId: string): FormTree | undefined;

  getChildId(
    parentId: string,
    childId: string,
    control: ControlDefinition,
  ): string;
}
