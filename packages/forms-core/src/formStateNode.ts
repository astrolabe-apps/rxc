import type { Control, ControlContext, ReadContext } from "@rxc/controls-core";
import { computed, effect } from "@rxc/controls-core";
import type { ControlDefinition } from "./json/controlDefinition";
import {
  getDisplayOnlyOptions,
  isDataControl,
  isGroupControl,
} from "./json/controlDefinition";
import type { SchemaField } from "./json/schemaField";
import { isCompoundField } from "./json/schemaField";
import type {
  CleanupScope,
  FormNodeOptions,
  FormNodeUi,
  FormState,
  FormStateNode,
  SchemaDataNode,
} from "./types";
import { schemaDataForFieldRef } from "./schemaDataNode";

// ── Internal state shape ────────────────────────────────────────────

interface InternalState {
  visible: boolean | null;
  disabled: boolean;
  readonly: boolean;
  dataNode: SchemaDataNode | undefined;
  childIndex: number;
}

interface Cleanupable {
  cleanup(): void;
}

interface ChildEntry {
  key: string;
  node: FormStateNodeImpl;
}

// ── Default FormNodeUi ──────────────────────────────────────────────

const defaultUi: FormNodeUi = {
  ensureVisible() {},
  ensureChildVisible() {},
  getDisabler() {
    return () => () => {};
  },
};

// ── FormState proxy implementation ──────────────────────────────────

function createFormStateView(
  impl: FormStateNodeImpl,
  rc: ReadContext,
): FormState {
  return {
    get data() {
      const dn = rc.getValue(impl.stateControl.fields.dataNode);
      return dn?.data;
    },
    get field() {
      const dn = rc.getValue(impl.stateControl.fields.dataNode);
      return dn?.getField(rc);
    },
    get visible() {
      return rc.getValue(impl.stateControl.fields.visible);
    },
    get disabled() {
      return rc.getValue(impl.stateControl.fields.disabled);
    },
    get readonly() {
      return rc.getValue(impl.stateControl.fields.readonly);
    },
    get childIndex() {
      return rc.getValue(impl.stateControl.fields.childIndex);
    },
    get busy() {
      return false; // TODO
    },
    get resolved() {
      return { definition: impl.definition };
    },
    get definition() {
      return impl.definition;
    },
    get valid() {
      const dn = rc.getValue(impl.stateControl.fields.dataNode);
      return dn ? rc.isValid(dn.data) : true;
    },
    get touched() {
      const dn = rc.getValue(impl.stateControl.fields.dataNode);
      return dn ? rc.isTouched(dn.data) : false;
    },
    get clearHidden() {
      return impl.globals.clearHidden;
    },
    get variables() {
      return impl.nodeOptions.variables;
    },
    get meta() {
      return impl.meta;
    },
    // FormNodeOptions
    get forceReadonly() {
      return impl.nodeOptions.forceReadonly;
    },
    get forceDisabled() {
      return impl.nodeOptions.forceDisabled;
    },
    get forceHidden() {
      return impl.nodeOptions.forceHidden;
    },
  };
}

// ── FormStateNode implementation ────────────────────────────────────

let nextUniqueId = 1;

class FormStateNodeImpl implements FormStateNode {
  readonly uniqueId: string;
  readonly stateControl: Control<InternalState>;
  readonly meta: Record<string, any> = {};
  private effects: Cleanupable[] = [];
  private childEntries: ChildEntry[] = [];
  private childrenInitialized = false;
  private childrenControl: Control<FormStateNodeImpl[]>;
  ui: FormNodeUi = defaultUi;

  constructor(
    readonly definition: ControlDefinition,
    readonly parentNode: FormStateNode | undefined,
    private parentData: SchemaDataNode,
    readonly globals: FormStateGlobals,
    readonly nodeOptions: FormNodeOptions,
    readonly childKey: string | number,
    childIndex: number,
  ) {
    this.uniqueId = String(nextUniqueId++);
    const ctx = globals.ctx;
    this.stateControl = ctx.newControl<InternalState>({
      visible: null,
      disabled: false,
      readonly: false,
      dataNode: undefined,
      childIndex,
    });
    this.childrenControl = ctx.newControl<FormStateNodeImpl[]>([]);

    this.initDataNode(ctx);
    this.initVisible(ctx);
    this.initReadonly(ctx);
    this.initDisabled(ctx);
    this.initSyncEffects(ctx);
    this.initValidation(ctx);
    this.initDefaultValue(ctx);
  }

  getState(rc: ReadContext): FormState {
    return createFormStateView(this, rc);
  }

  getChildren(rc: ReadContext): FormStateNode[] {
    if (!this.childrenInitialized) {
      this.childrenInitialized = true;
      this.initChildren(this.globals.ctx);
    }
    return rc.getValue(this.childrenControl) as FormStateNode[];
  }

  // ── Mutators ────────────────────────────────────────────────────

  setTouched(b: boolean, _notChildren?: boolean): void {
    const dataNode = this.stateControl.fields.dataNode.valueNow;
    if (dataNode) {
      this.globals.ctx.update((wc) => wc.setTouched(dataNode.data, b));
    }
  }

  validate(): boolean {
    // TODO: full validation
    return true;
  }

  ensureMeta<A>(key: string, init: (scope: CleanupScope) => A): A {
    if (key in this.meta) return this.meta[key];
    const cleanups: (() => void)[] = [];
    const scope: CleanupScope = {
      addCleanup(fn) {
        cleanups.push(fn);
      },
    };
    const val = init(scope);
    this.meta[key] = val;
    return val;
  }

  attachUi(f: FormNodeUi): void {
    this.ui = f;
  }

  setBusy(_busy: boolean): void {
    // TODO
  }

  setForceDisabled(_forceDisable: boolean): void {
    // TODO
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

  // ── Init methods ────────────────────────────────────────────────

  private initDataNode(ctx: ControlContext) {
    const def = this.definition;
    const fieldPath = isDataControl(def)
      ? def.field
      : isGroupControl(def)
        ? def.compoundField
        : undefined;

    if (fieldPath) {
      this.effects.push(
        computed(ctx, this.stateControl.fields.dataNode, (rc) =>
          schemaDataForFieldRef(rc, fieldPath, this.parentData),
        ),
      );
    }
  }

  private initVisible(ctx: ControlContext) {
    this.effects.push(
      computed(ctx, this.stateControl.fields.visible, (rc) => {
        if (this.nodeOptions.forceHidden) return false;
        if (this.parentNode) {
          const parentState = this.parentNode.getState(rc);
          if (parentState.visible === false) return false;
        }
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (
          dn &&
          (!isValidDataNode(dn, rc) ||
            hideDisplayOnly(dn, rc, this.definition, this.globals))
        )
          return false;
        return this.definition.hidden == null ? null : !this.definition.hidden;
      }),
    );
  }

  private initReadonly(ctx: ControlContext) {
    this.effects.push(
      computed(ctx, this.stateControl.fields.readonly, (rc) => {
        if (this.parentNode) {
          const parentState = this.parentNode.getState(rc);
          if (parentState.readonly) return true;
        }
        return this.nodeOptions.forceReadonly || !!this.definition.readonly;
      }),
    );
  }

  private initDisabled(ctx: ControlContext) {
    this.effects.push(
      computed(ctx, this.stateControl.fields.disabled, (rc) => {
        if (this.parentNode) {
          const parentState = this.parentNode.getState(rc);
          if (parentState.disabled) return true;
        }
        return this.nodeOptions.forceDisabled || !!this.definition.disabled;
      }),
    );
  }

  private initSyncEffects(ctx: ControlContext) {
    // Sync disabled → data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (dn) {
          const disabled = rc.getValue(this.stateControl.fields.disabled);
          ctx.update((wc) => wc.setDisabled(dn.data, disabled));
        }
      }),
    );

    // Sync touched: form state → data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (dn) {
          const touched = rc.isTouched(this.stateControl);
          ctx.update((wc) => wc.setTouched(dn.data, touched));
        }
      }),
    );

    // Sync touched: data control → form state
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (dn) {
          const dataTouched = rc.isTouched(dn.data);
          ctx.update((wc) => wc.setTouched(this.stateControl, dataTouched));
        }
      }),
    );

    // Mirror errors from data control
    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (dn) {
          const errors = rc.getErrors(dn.data);
          ctx.update((wc) => wc.setErrors(this.stateControl, errors));
        } else {
          ctx.update((wc) => wc.setErrors(this.stateControl, null));
        }
      }),
    );
  }

  private initValidation(ctx: ControlContext) {
    if (!isDataControl(this.definition) || !this.definition.required) return;

    const isEmptyValue =
      this.globals.isEmptyValue ??
      ((_: SchemaField, v: unknown) => v == null || v === "");

    this.effects.push(
      effect(ctx, (rc) => {
        const visible = rc.getValue(this.stateControl.fields.visible);
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (!visible || !dn) return;
        const value = rc.getValue(dn.data);
        const field = dn.getField(rc);
        const error = isEmptyValue(field, value)
          ? "This field is required"
          : undefined;
        ctx.update((wc) => wc.setError(dn.data, "default", error));
      }),
    );
  }

  private initDefaultValue(ctx: ControlContext) {
    if (!isDataControl(this.definition)) return;
    const dataDef = this.definition;

    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        if (!dn) return;

        const visible = rc.getValue(this.stateControl.fields.visible);
        const value = rc.getValue(dn.data);

        if (visible === false) {
          if (this.globals.clearHidden && !dataDef.dontClearHidden) {
            ctx.update((wc) => wc.setValue(dn.data, undefined));
          }
        } else if (
          visible &&
          value === undefined &&
          dataDef.defaultValue != null
        ) {
          ctx.update((wc) => wc.setValue(dn.data, dataDef.defaultValue));
        }
      }),
    );
  }

  private initChildren(ctx: ControlContext) {
    const childDefs = this.definition.children;
    if (!childDefs || childDefs.length === 0) return;

    this.effects.push(
      effect(ctx, (rc) => {
        const dn = rc.getValue(this.stateControl.fields.dataNode);
        const dataContext = dn ?? this.parentData;

        const newKeys = childDefs.map((d, i) => this.childKeyFor(d, i));

        const oldMap = new Map(this.childEntries.map((e) => [e.key, e]));
        const newEntries: ChildEntry[] = [];

        for (let i = 0; i < childDefs.length; i++) {
          const key = newKeys[i];
          const existing = oldMap.get(key);
          if (existing) {
            ctx.update((wc) =>
              wc.setValue(existing.node.stateControl.fields.childIndex, i),
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
              key,
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
            this.childrenControl,
            newEntries.map((e) => e.node),
          ),
        );
      }),
    );
  }

  private childKeyFor(def: ControlDefinition, index: number): string {
    const field = isDataControl(def)
      ? def.field
      : isGroupControl(def)
        ? def.compoundField
        : undefined;
    return field ?? `child_${index}`;
  }
}

// ── Helper functions ────────────────────────────────────────────────

function isValidDataNode(dataNode: SchemaDataNode, rc: ReadContext): boolean {
  const parent = dataNode.parent;
  if (!parent) return true;
  const field = dataNode.getField(rc);
  const types = field.onlyForTypes;
  if (!types || types.length === 0) return true;

  const parentField = parent.getField(rc);
  if (!isCompoundField(parentField)) return true;
  const typeField = parentField.children.find((f) => f.isTypeField);
  if (!typeField) return true;

  const typeControl = (parent.data as Control<Record<string, unknown>>).fields[
    typeField.field
  ] as Control<string | undefined>;
  const typeValue = rc.getValue(typeControl);
  return typeValue != null && types.includes(typeValue);
}

function hideDisplayOnly(
  context: SchemaDataNode,
  rc: ReadContext,
  definition: ControlDefinition,
  globals: FormStateGlobals,
): boolean {
  const displayOptions = getDisplayOnlyOptions(definition);
  if (!displayOptions || displayOptions.emptyText) return false;
  const isEmptyValue =
    globals.isEmptyValue ??
    ((_: SchemaField, v: unknown) => v == null || v === "");
  const value = rc.getValue(context.data);
  return isEmptyValue(context.getField(rc), value);
}

// ── Public API ──────────────────────────────────────────────────────

export interface FormStateGlobals {
  ctx: ControlContext;
  clearHidden: boolean;
  isEmptyValue?: (field: SchemaField, value: unknown) => boolean;
}

export function createFormStateNode(
  definition: ControlDefinition,
  parentData: SchemaDataNode,
  globals: FormStateGlobals,
  options?: FormNodeOptions,
): FormStateNode {
  return new FormStateNodeImpl(
    definition,
    undefined,
    parentData,
    globals,
    options ?? {
      forceReadonly: false,
      forceDisabled: false,
      forceHidden: false,
    },
    "root",
    0,
  );
}
