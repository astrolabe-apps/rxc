import type {
  Control,
  ControlContext,
  ReadContext,
} from "@rxc/controls-core";
import { computed, effect } from "@rxc/controls-core";
import {
  ControlDefinitionType,
  getDisplayOnlyOptions,
  isDataControl,
  isGroupControl,
} from "./json/controlDefinition";
import type { ControlDefinition, DataControlDefinition } from "./json/controlDefinition";
import type {
  FormGlobalOptions,
  FormNodeOptions,
  FormStateNode,
  FormStateNodeState,
} from "./types";
import { SchemaDataNode, schemaDataForFieldRef } from "./schemaDataNode";
import { isCompoundField } from "./json/schemaField";

interface Cleanupable {
  cleanup(): void;
}

interface ChildEntry {
  key: string;
  node: FormStateNodeImpl;
}

class FormStateNodeImpl implements FormStateNode {
  readonly stateControl: Control<FormStateNodeState>;
  private effects: Cleanupable[] = [];
  private childEntries: ChildEntry[] = [];

  constructor(
    readonly definition: ControlDefinition,
    readonly parentNode: FormStateNode | undefined,
    private parent: SchemaDataNode,
    private globals: FormGlobalOptions,
    private nodeOptions: FormNodeOptions,
    childIndex: number,
  ) {
    const ctx = globals.ctx;
    this.stateControl = ctx.newControl<FormStateNodeState>({
      visible: null,
      disabled: false,
      readonly: false,
      dataNode: undefined,
      children: [],
      childIndex,
    });

    this.initDataNode(ctx);
    this.initVisible(ctx);
    this.initReadonly(ctx);
    this.initDisabled(ctx);
    this.initSyncEffects(ctx);
    this.initValidation(ctx);
    this.initDefaultValue(ctx);
    this.initChildren(ctx);
  }

  private initDataNode(ctx: ControlContext) {
    const def = this.definition;
    const fieldPath = isDataControl(def)
      ? def.field
      : isGroupControl(def)
        ? def.compoundField
        : undefined;

    if (fieldPath) {
      const dataNodeControl = this.stateControl.fields
        .dataNode as Control<any>;
      this.effects.push(
        computed(ctx, dataNodeControl, (rc) =>
          schemaDataForFieldRef(rc, fieldPath, this.parent),
        ),
      );
    }
  }

  private initVisible(ctx: ControlContext) {
    const visibleControl = this.stateControl.fields.visible as Control<any>;
    this.effects.push(
      computed(ctx, visibleControl, (rc) => {
        if (this.nodeOptions.forceHidden) return false;
        if (this.parentNode) {
          const parentVisible = rc.getValue(
            this.parentNode.stateControl.fields.visible as Control<boolean | null>,
          );
          if (parentVisible === false) return false;
        }
        const dn = rc.getValue(this.stateControl.fields.dataNode as Control<SchemaDataNode | undefined>);
        if (dn && (!isValidDataNode(dn, rc) || hideDisplayOnly(dn, rc, this.definition, this.globals))) return false;
        return this.definition.hidden == null
          ? null
          : !this.definition.hidden;
      }),
    );
  }

  private initReadonly(ctx: ControlContext) {
    const readonlyControl = this.stateControl.fields
      .readonly as Control<any>;
    this.effects.push(
      computed(ctx, readonlyControl, (rc) => {
        if (this.parentNode) {
          const parentReadonly = rc.getValue(
            this.parentNode.stateControl.fields.readonly as Control<boolean>,
          );
          if (parentReadonly) return true;
        }
        return (
          this.nodeOptions.forceReadonly || !!this.definition.readonly
        );
      }),
    );
  }

  private initDisabled(ctx: ControlContext) {
    const disabledControl = this.stateControl.fields
      .disabled as Control<any>;
    this.effects.push(
      computed(ctx, disabledControl, (rc) => {
        if (this.parentNode) {
          const parentDisabled = rc.getValue(
            this.parentNode.stateControl.fields.disabled as Control<boolean>,
          );
          if (parentDisabled) return true;
        }
        return (
          this.nodeOptions.forceDisabled || !!this.definition.disabled
        );
      }),
    );
  }

  private initSyncEffects(ctx: ControlContext) {
    // Sync disabled → data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (dn) {
          const disabled = rc.getValue(
            this.stateControl.fields.disabled as Control<boolean>,
          );
          ctx.update((wc) => wc.setDisabled(dn.control, disabled));
        }
      }),
    );

    // Sync touched: form state → data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (dn) {
          const touched = rc.isTouched(this.stateControl);
          ctx.update((wc) => wc.setTouched(dn.control, touched));
        }
      }),
    );

    // Sync touched: data control → form state
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (dn) {
          const dataTouched = rc.isTouched(dn.control);
          ctx.update((wc) =>
            wc.setTouched(this.stateControl, dataTouched),
          );
        }
      }),
    );

    // Mirror errors from data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (dn) {
          const errors = rc.getErrors(dn.control);
          ctx.update((wc) => wc.setErrors(this.stateControl, errors));
        } else {
          ctx.update((wc) => wc.setErrors(this.stateControl, null));
        }
      }),
    );
  }

  private initValidation(ctx: ControlContext) {
    if (!isDataControl(this.definition) || !this.definition.required) return;
    const dataDef = this.definition;

    const isEmptyValue =
      this.globals.isEmptyValue ?? ((_, v) => v == null || v === "");

    this.effects.push(
      effect(ctx, (rc) => {
        const visible = rc.getValue(
          this.stateControl.fields.visible as Control<boolean | null>,
        );
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (!visible || !dn) return;
        const value = rc.getValue(dn.control);
        const error = isEmptyValue(dn.schema.getField(rc), value)
          ? "This field is required"
          : undefined;
        ctx.update((wc) => wc.setError(dn.control, "default", error));
      }),
    );
  }

  private initDefaultValue(ctx: ControlContext) {
    if (!isDataControl(this.definition)) return;
    const dataDef = this.definition;

    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        if (!dn) return;

        const visible = rc.getValue(
          this.stateControl.fields.visible as Control<boolean | null>,
        );
        const value = rc.getValue(dn.control);

        if (visible === false) {
          if (this.globals.clearHidden && !dataDef.dontClearHidden) {
            ctx.update((wc) => wc.setValue(dn.control, undefined));
          }
        } else if (
          visible &&
          value === undefined &&
          dataDef.defaultValue != null
        ) {
          ctx.update((wc) =>
            wc.setValue(dn.control, dataDef.defaultValue),
          );
        }
      }),
    );
  }

  private initChildren(ctx: ControlContext) {
    const childDefs = this.definition.children;
    if (!childDefs || childDefs.length === 0) return;

    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(
          this.stateControl.fields.dataNode as Control<
            SchemaDataNode | undefined
          >,
        );
        const dataContext = dn ?? this.parent;

        const newKeys = childDefs.map((d, i) => this.childKey(d, i));

        const oldMap = new Map(
          this.childEntries.map((e) => [e.key, e]),
        );
        const newEntries: ChildEntry[] = [];

        for (let i = 0; i < childDefs.length; i++) {
          const key = newKeys[i];
          const existing = oldMap.get(key);
          if (existing) {
            ctx.update((wc) =>
              wc.setValue(
                existing.node.stateControl.fields
                  .childIndex as Control<number>,
                i,
              ),
            );
            newEntries.push(existing);
            oldMap.delete(key);
          } else {
            const childNode = new FormStateNodeImpl(
              childDefs[i],
              this,
              dataContext,
              this.globals,
              {
                forceReadonly: false,
                forceDisabled: false,
                forceHidden: false,
              },
              i,
            );
            newEntries.push({ key, node: childNode });
          }
        }

        for (const removed of oldMap.values()) {
          removed.node.cleanup();
        }

        this.childEntries = newEntries;

        ctx.update((wc) =>
          wc.setValue(
            this.stateControl.fields.children as Control<
              FormStateNodeState[]
            >,
            newEntries.map((e) => e.node.stateControl.valueNow),
          ),
        );
      }),
    );
  }

  private childKey(def: ControlDefinition, index: number): string {
    const field = isDataControl(def)
      ? def.field
      : isGroupControl(def)
        ? def.compoundField
        : undefined;
    return field ?? `child_${index}`;
  }

  getDefinition(_rc: ReadContext): ControlDefinition {
    return this.definition;
  }

  getState(rc: ReadContext): FormStateNodeState {
    const fields = this.stateControl.fields as any;
    return {
      visible: rc.getValue(fields.visible),
      disabled: rc.getValue(fields.disabled),
      readonly: rc.getValue(fields.readonly),
      dataNode: rc.getValue(fields.dataNode),
      children: rc.getValue(fields.children),
      childIndex: rc.getValue(fields.childIndex),
    };
  }

  getChildren(_rc: ReadContext): FormStateNode[] {
    return this.childEntries.map((e) => e.node);
  }

  cleanup(): void {
    for (const eff of this.effects) {
      eff.cleanup();
    }
    this.effects = [];
    for (const child of this.childEntries) {
      child.node.cleanup();
    }
    this.childEntries = [];
  }
}

function isValidDataNode(
  dataNode: SchemaDataNode,
  rc: ReadContext,
): boolean {
  const parent = dataNode.parent;
  if (!parent) return true;
  const field = dataNode.schema.getField(rc);
  const types = field.onlyForTypes;
  if (!types || types.length === 0) return true;

  const parentField = parent.schema.getField(rc);
  if (!isCompoundField(parentField)) return true;
  const typeField = parentField.children.find((f) => f.isTypeField);
  if (!typeField) return true;

  const typeControl = (
    parent.control as Control<Record<string, unknown>>
  ).fields[typeField.field] as Control<string | undefined>;
  const typeValue = rc.getValue(typeControl);
  return typeValue != null && types.includes(typeValue);
}

function hideDisplayOnly(
  context: SchemaDataNode,
  rc: ReadContext,
  definition: ControlDefinition,
  globals: FormGlobalOptions,
): boolean {
  const displayOptions = getDisplayOnlyOptions(definition);
  if (!displayOptions || displayOptions.emptyText) return false;
  const isEmptyValue =
    globals.isEmptyValue ?? ((_, v) => v == null || v === "");
  const value = rc.getValue(context.control);
  return isEmptyValue(context.schema.getField(rc), value);
}

export function createFormStateNode(
  definition: ControlDefinition,
  parent: SchemaDataNode,
  globals: FormGlobalOptions,
  options?: FormNodeOptions,
): FormStateNode {
  return new FormStateNodeImpl(
    definition,
    undefined,
    parent,
    globals,
    options ?? { forceReadonly: false, forceDisabled: false, forceHidden: false },
    0,
  );
}
