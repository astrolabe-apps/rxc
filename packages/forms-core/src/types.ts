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
  // parent?: SchemaDataNode;
  // node?: FormNode | null;
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>;
  resolveChildren?: ChildResolverFunc;
}

export interface FormGlobalOptions {
  // schemaInterface: SchemaInterface;
  // evalExpression: (e: EntityExpression, ctx: ExpressionEvalContext) => void;
  resolveChildren(c: FormStateNode): ChildNodeSpec[];
  runAsync: (af: () => void) => void;
  clearHidden: boolean;
  // controlDefinitionSchema?: SchemaNode;
}

export interface ResolvedDefinition {
  definition: ControlDefinition;
  stateId?: string;
  fieldOptions?: FieldOption[];
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
  getState(rc: ReadContext): FormState;
  getChildren(rc: ReadContext): FormStateNode[];
  // getDataNode(rc: ReadContext): SchemaDataNode | undefined;
  setTouched(b: boolean, notChildren?: boolean): void;
  validate(): boolean;
  ensureMeta<A>(key: string, init: (scope: CleanupScope) => A): A;
  cleanup(): void;
  ui: FormNodeUi;
  attachUi(f: FormNodeUi): void;
  setBusy(busy: boolean): void;
  setForceDisabled(forceDisable: boolean): void;
  // schemaInterface: SchemaInterface;
}

export interface FormState extends FormNodeOptions {
  data?: Control<unknown>;
  field?: SchemaField;
  readonly: boolean;
  visible: boolean | null;
  disabled: boolean;
  resolved: ResolvedDefinition;
  childIndex: number;
  busy: boolean;
  definition: ControlDefinition;
  valid: boolean;
  touched: boolean;
  clearHidden: boolean;
  variables?: (changes: ChangeListenerFunc<any>) => Record<string, any>;
  meta: Record<string, any>;
}

export interface SchemaCursorRef  {
  id: string;
  get(rd: ReadContext): SchemaCursor;
}

export interface SchemaCursor {
  ref: SchemaCursorRef;
  field: SchemaField;
  // these are the resolved children
  children: SchemaCursor[];
  parent?: SchemaCursor;
}

export interface DataCursorRef {
  id: string;
  get(rd: ReadContext): DataCursor;
}

export interface DataCursor {
  ref: DataCursorRef;
  field: SchemaField;
  control: Control<unknown>;
  elementIndex?: number;
  getField(field: string): DataCursor | undefined;
  getElement(elementIndex: number): DataCursor | undefined;
  parent?: DataCursor;
}

export interface FormCursorRef  {
  id: string;
  get(rd: ReadContext): FormCursor;
}

export interface FormCursor {
  ref: FormCursorRef;
  field: ControlDefinition;
  // these are the resolved children
  children: FormCursor[];
  parent?: FormCursor;
}
