import type { Control, ReadContext, ControlContext } from "@rxc/controls-core";
import type { SchemaField } from "./json/schemaField";
import type { ControlDefinition } from "./json/controlDefinition";
import type { SchemaDataNode } from "./schemaDataNode";

// ── FormStateNode state ──────────────────────────────────────────────

export interface FormStateNodeState {
  visible: boolean | null;
  disabled: boolean;
  readonly: boolean;
  dataNode: SchemaDataNode | undefined;
  children: FormStateNodeState[];
  childIndex: number;
}

// ── FormStateNode interface ──────────────────────────────────────────

export interface FormStateNode {
  readonly stateControl: Control<FormStateNodeState>;
  readonly definition: ControlDefinition;
  readonly parentNode: FormStateNode | undefined;

  getDefinition(rc: ReadContext): ControlDefinition;
  getState(rc: ReadContext): FormStateNodeState;
  getChildren(rc: ReadContext): FormStateNode[];
  cleanup(): void;
}

// ── FormStateNode options ────────────────────────────────────────────

export interface FormNodeOptions {
  forceReadonly?: boolean;
  forceDisabled?: boolean;
  forceHidden?: boolean;
}

export interface FormGlobalOptions {
  ctx: ControlContext;
  clearHidden: boolean;
  isEmptyValue?: (field: SchemaField, value: any) => boolean;
}
