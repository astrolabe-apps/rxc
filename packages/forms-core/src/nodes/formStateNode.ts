import {
  type ChangeListenerFunc,
  type Control,
  type ControlContext,
  type ReadContext,
  computed,
  effect,
  noopReadContext,
} from "@rxc/controls-core";
import {
  type ControlAdornment,
  ControlAdornmentType,
  type ControlDefinition,
  type ControlDisableType,
  DataRenderType,
  type FieldOption,
  getDisplayOnlyOptions,
  isControlDisabled,
  isControlReadonly,
  isDataControl,
} from "../json";
import type {
  ChildNodeSpec,
  ChildResolverFunc,
  CleanupScope,
  DataCursor,
  DataNode,
  FormGlobalOptions,
  FormNode,
  FormNodeOptions,
  FormNodeUi,
  FormState,
  FormStateNode,
  ResolvedDefinition,
  VariablesFunc,
} from "../types";
import { dataRef, formFieldPath, validDataCursor } from "../cursorUtils";
import {
  defaultSchemaInterface,
  type SchemaInterface,
} from "../schemaInterface";
import { setupValidation } from "../validators";
import {
  createEvaluatedDefinition,
  type EvaluatedDefinition,
  type ScriptProvider,
} from "../scriptedProxy";
import { buildLegacyScripts } from "../legacyScripts";

// ── Public API ─────────────────────────────────────────────────────

/**
 * Create the root {@link FormStateNode} for a form tree.
 *
 * @param ctx        - The {@link ControlContext} that owns all controls created
 *                     by this form state tree (and its descendants).
 * @param formNode   - The root {@link FormNode} of the form definition tree.
 * @param parent     - The {@link DataNode} whose data provides the root data
 *                     context for the form.
 * @param options    - Tree-wide globals (resolver, clearHidden, async runner).
 * @param nodeOptions - Initial per-node options (force flags, variables).
 *
 * Layer 1 limitations:
 * - No script overrides (`state.resolved.definition === formNode.definition`
 *   at build time). The definition is snapshotted at init.
 * - No schema-interface driven `fieldOptions` / display-only hiding.
 * - No dynamic validators from schema field / control definition.
 */
export function createFormStateNode(
  ctx: ControlContext,
  formNode: FormNode,
  parent: DataNode,
  options: FormGlobalOptions,
  nodeOptions: FormNodeOptions = {},
): FormStateNode {
  const rootDef = formNode.cursor(noopReadContext).definition;
  const resolved: FormGlobalOptions = {
    ...options,
    schemaInterface: options.schemaInterface ?? defaultSchemaInterface,
  };
  return new FormStateNodeImpl(
    ctx,
    "ROOT",
    {},
    rootDef,
    formNode,
    nodeOptions,
    resolved,
    parent,
    undefined,
    0,
    resolved.resolveChildren,
  );
}

// ── Internal impl ──────────────────────────────────────────────────

/**
 * Internal shape of the reactive state held in each node's `base` Control.
 *
 * Storing children as a nested Control (rather than a plain array) is
 * deliberate — the built-in valid/disabled/touched aggregation on Controls
 * propagates child validity/state up through the form state tree "for free".
 * Each child's `base` Control is an element of this Control's `children`
 * array and carries a `$FormState` meta pointer back to its FormStateNode.
 */
interface FormStateBaseImpl {
  readonly: boolean;
  visible: boolean | null;
  disabled: boolean;
  children: FormStateBaseImpl[];
  resolved: ResolvedDefinition;
  dataNode: DataNode | undefined;
  childIndex: number;
  nodeOptions: FormNodeOptions;
  busy: boolean;
}

const FORM_STATE_META_KEY = "$FormState";

const noopUi: FormNodeUi = {
  ensureChildVisible() {},
  ensureVisible() {},
  getDisabler(_type: ControlDisableType) {
    return () => () => {};
  },
};

class FormStateNodeImpl implements FormStateNode {
  readonly base: Control<FormStateBaseImpl>;
  readonly resolveChildren: ChildResolverFunc;
  /** Set by {@link initFormState} before any computed reads it. */
  evaluatedDef!: EvaluatedDefinition;

  ui: FormNodeUi = noopUi;

  private _childrenInitialized = false;
  private _cleanups: Array<() => void> = [];

  constructor(
    public readonly ctx: ControlContext,
    public childKey: string | number,
    public meta: Record<string, any>,
    definition: ControlDefinition,
    public form: FormNode | null | undefined,
    nodeOptions: FormNodeOptions,
    public readonly globals: FormGlobalOptions,
    public parent: DataNode,
    public parentNode: FormStateNode | undefined,
    childIndex: number,
    resolveChildren?: ChildResolverFunc,
  ) {
    const base = ctx.newControl<FormStateBaseImpl>(
      {
        readonly: false,
        visible: null,
        disabled: false,
        children: [],
        resolved: { definition } as ResolvedDefinition,
        dataNode: undefined,
        childIndex,
        nodeOptions,
        busy: false,
      },
      { dontClearError: true },
    );
    this.base = base;
    (base.meta as Record<string, unknown>)[FORM_STATE_META_KEY] = this;
    this.resolveChildren = resolveChildren ?? globals.resolveChildren;

    initFormState(this, definition, parentNode);
  }

  get uniqueId(): string {
    return this.base.uniqueId.toString();
  }

  get schemaInterface(): SchemaInterface {
    return this.globals.schemaInterface ?? defaultSchemaInterface;
  }

  get dataNode(): DataNode | undefined {
    // Snapshot access; reactive callers should use getState(rc).data / .field.
    return this.base.fieldsNow.dataNode?.valueNow as DataNode | undefined;
  }

  getState(rc: ReadContext): FormState {
    return new FormStateView(this, rc);
  }

  getChildren(rc: ReadContext): FormStateNode[] {
    this.ensureChildren();
    const childrenControl = this.base.fields.children;
    const elems = rc.getElements(childrenControl) as Control<FormStateBaseImpl>[];
    return elems.map(
      (el) =>
        (el.meta as Record<string, unknown>)[
          FORM_STATE_META_KEY
        ] as FormStateNode,
    );
  }

  setTouched(touched: boolean, notChildren?: boolean): void {
    this.ctx.update((wc) => wc.setTouched(this.base, touched, notChildren));
  }

  validate(): boolean {
    for (const child of this.getChildren(noopReadContext)) {
      child.validate();
    }
    const dn = this.dataNode;
    if (dn) {
      this.ctx.update((wc) => wc.validate(dn.cursor(noopReadContext).control));
    }
    return this.base.validNow;
  }

  ensureMeta<A>(key: string, init: (scope: CleanupScope) => A): A {
    if (key in this.meta) return this.meta[key] as A;
    const scope: CleanupScope = {
      addCleanup: (fn) => this._cleanups.push(fn),
    };
    const res = init(scope);
    this.meta[key] = res;
    return res;
  }

  cleanup(): void {
    for (const child of this.getChildren(noopReadContext)) {
      child.cleanup();
    }
    for (const fn of this._cleanups) fn();
    this._cleanups = [];
    // Drop references held via meta so controls can be GC'd.
    delete (this.base.meta as Record<string, unknown>)[FORM_STATE_META_KEY];
  }

  attachUi(f: FormNodeUi): void {
    this.ui = f;
  }

  setBusy(busy: boolean): void {
    this.ctx.update((wc) => wc.setValue(this.base.fields.busy, busy));
  }

  setForceDisabled(forceDisable: boolean): void {
    this.ctx.update((wc) =>
      wc.updateValue(this.base.fields.nodeOptions, (opt) => ({
        ...opt,
        forceDisabled: forceDisable,
      })),
    );
  }

  // ── internal helpers used by initFormState / initChildren ────────

  addCleanup(fn: () => void): void {
    this._cleanups.push(fn);
  }

  ensureChildren(): void {
    if (this._childrenInitialized) return;
    this._childrenInitialized = true;
    initChildren(this);
  }
}

// ── Lens / ephemeral view ──────────────────────────────────────────

/**
 * Ephemeral {@link FormState} view bound to a specific {@link ReadContext}.
 * Holds no state of its own — each property read routes through `rc` to the
 * underlying controls on the node's `base`, registering a single fine-grained
 * dependency.
 */
class FormStateView implements FormState {
  constructor(
    private readonly impl: FormStateNodeImpl,
    private readonly rc: ReadContext,
  ) {}

  private get baseFields() {
    return this.impl.base.fields;
  }

  get data(): Control<unknown> | undefined {
    const dn = this.rc.getValue(this.baseFields.dataNode);
    if (!dn) return undefined;
    return dn.cursor(this.rc).control;
  }

  get field() {
    const dn = this.rc.getValue(this.baseFields.dataNode);
    if (!dn) return undefined;
    return dn.cursor(this.rc).field;
  }

  get readonly(): boolean {
    return this.rc.getValue(this.baseFields.readonly);
  }

  get visible(): boolean | null {
    return this.rc.getValue(this.baseFields.visible);
  }

  get disabled(): boolean {
    return this.rc.getValue(this.baseFields.disabled);
  }

  get resolved(): ResolvedDefinition {
    // Splice the rc-bound scripted proxy in as `.definition` so callers
    // reading `state.resolved.definition.X` see live script values. The
    // underlying control still holds the raw base definition.
    const raw = this.rc.getValue(this.baseFields.resolved);
    return {
      ...raw,
      definition: this.impl.evaluatedDef.toProxy(this.rc),
    };
  }

  get childIndex(): number {
    return this.rc.getValue(this.baseFields.childIndex);
  }

  get busy(): boolean {
    return this.rc.getValue(this.baseFields.busy);
  }

  get definition(): ControlDefinition {
    return this.resolved.definition;
  }

  get valid(): boolean {
    return this.rc.isValid(this.impl.base);
  }

  get touched(): boolean {
    return this.rc.isTouched(this.impl.base);
  }

  get clearHidden(): boolean {
    return this.impl.globals.clearHidden;
  }

  get variables(): VariablesFunc | undefined {
    return this.rc.getValue(this.baseFields.nodeOptions).variables;
  }

  get meta(): Record<string, any> {
    return this.impl.meta;
  }

  // ── FormNodeOptions mirror ─────────────────────────────────────

  get forceReadonly() {
    return this.rc.getValue(this.baseFields.nodeOptions).forceReadonly;
  }
  get forceDisabled() {
    return this.rc.getValue(this.baseFields.nodeOptions).forceDisabled;
  }
  get forceHidden() {
    return this.rc.getValue(this.baseFields.nodeOptions).forceHidden;
  }
}

// ── Wiring ─────────────────────────────────────────────────────────

/**
 * Set up computed properties and sync effects for a FormStateNode.
 *
 * Layer-1 simplifications:
 * - No script override / editor-mode reactive definition. The definition
 *   passed in at construction time is used as-is; `resolved.definition` is
 *   the same object for the life of the node.
 * - No schema-interface-driven visibility (`validDataNode` / `hideDisplayOnly`).
 * - No dynamic `fieldOptions`.
 * - No setupValidation.
 */
function initFormState(
  impl: FormStateNodeImpl,
  definition: ControlDefinition,
  parentNode: FormStateNode | undefined,
): void {
  const { ctx, base, parent } = impl;
  const { dataNode, visible, readonly, disabled } = base.fields;
  const schemaInterface = impl.schemaInterface;

  // ── dataNode: resolve the definition's field path against the parent
  const fieldRef = formFieldPath(definition);
  const dataNodeComputed = computed(ctx, dataNode, (rc) => {
    if (fieldRef === undefined) return undefined;
    const parentCursor = parent.cursor(rc);
    const resolved = dataRef(parentCursor, fieldRef);
    return resolved?.node;
  });
  impl.addCleanup(() => dataNodeComputed.cleanup());

  // ── scripted-definition wrapper. Layer-4a builds a per-node override
  // hierarchy from explicit `$scripts` plus legacy `dynamic[]` entries
  // (via buildLegacyScripts). The returned EvaluatedDefinition supplies
  // a per-rc proxy — subsequent computeds/effects read scriptable fields
  // (`hidden`, `disabled`, `readonly`, `defaultValue`, …) through it.
  const legacyMap = buildLegacyScripts(definition);
  const getScripts: ScriptProvider = (target, path) => {
    const explicit =
      ((target as unknown as Record<string, unknown>)?.["$scripts"] as Record<
        string,
        import("../json").EntityExpression
      >) ?? {};
    const legacy = legacyMap.get(path) ?? {};
    return { ...legacy, ...explicit };
  };
  // The scripted proxy needs a DataNode to resolve data expressions
  // against. Use the node's own dataNode once resolved, falling back to
  // the starting parent when this node doesn't bind data.
  const initialData = impl.dataNode ?? parent;
  impl.evaluatedDef = createEvaluatedDefinition(
    definition,
    ctx,
    initialData,
    schemaInterface,
    impl.globals.runAsync,
    undefined, // variables — plumbed through for jsonata in a follow-up
    (fn) => impl.addCleanup(fn),
    getScripts,
  );

  // ── visibility cascade — see docs/FORM-SEMANTICS.md "Visible".
  //   1. forceHidden → false
  //   2. parent visible is falsy (false OR null) → inherit parent
  //   3. data node exists and validDataCursor() is false → false
  //   4. data node exists and hideDisplayOnly() is true → false
  //   5. otherwise: `def.hidden == null ? null : !def.hidden`
  //
  // `null` only arises when an async Visible/Hidden script is mid-
  // evaluation — see the `_ScriptNullInit` tag in schemaSchemas.ts. The
  // scripted proxy coerces `hidden` to its boolean default when no script
  // is registered, so `null` never flows through in the non-pending case.
  const visibleComputed = computed(ctx, visible, (rc) => {
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceHidden) return false;
    if (parentNode) {
      const parentVisible = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.visible,
      );
      if (!parentVisible) return parentVisible;
    }
    const dn = rc.getValue(dataNode);
    const def = impl.evaluatedDef.toProxy(rc);
    if (dn) {
      const dc = dn.cursor(rc);
      if (!validDataCursor(dc)) return false;
      if (hideDisplayOnly(dc, schemaInterface, def)) return false;
    }
    return def.hidden == null ? null : !def.hidden;
  });
  impl.addCleanup(() => visibleComputed.cleanup());

  // ── fieldOptions: options list visible to the renderer, filtered by the
  // definition's `allowedOptions` (when present — itself scriptable). With
  // no `allowedOptions` this passes through whatever the schemaInterface
  // provides.
  const fieldOptionsControl = base.fields.resolved.fields.fieldOptions;
  const fieldOptionsComputed = computed(
    ctx,
    fieldOptionsControl,
    (rc) => {
      const dn = rc.getValue(dataNode);
      if (!dn) return undefined;
      const dc = dn.cursor(rc);
      const all = schemaInterface.getDataOptions(dc);
      const def = impl.evaluatedDef.toProxy(rc);
      const allowed = def.allowedOptions;
      const allowedArr = Array.isArray(allowed)
        ? allowed
        : allowed != null
          ? [allowed]
          : [];
      if (allowedArr.length === 0) return all ?? undefined;
      const filtered: FieldOption[] = [];
      for (const entry of allowedArr) {
        if (typeof entry === "object" && entry != null) {
          filtered.push(entry as FieldOption);
          continue;
        }
        const match = all?.find((o) => o.value == entry);
        filtered.push(match ?? { name: String(entry), value: entry });
      }
      return filtered;
    },
  );
  impl.addCleanup(() => fieldOptionsComputed.cleanup());

  // ── readonly cascade — `readonly` may be scripted, so read through proxy.
  const readonlyComputed = computed(ctx, readonly, (rc) => {
    if (parentNode) {
      const pr = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.readonly,
      );
      if (pr) return true;
    }
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceReadonly) return true;
    return isControlReadonly(impl.evaluatedDef.toProxy(rc));
  });
  impl.addCleanup(() => readonlyComputed.cleanup());

  // ── disabled cascade — `disabled` may be scripted, so read through proxy.
  const disabledComputed = computed(ctx, disabled, (rc) => {
    if (parentNode) {
      const pd = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.disabled,
      );
      if (pd) return true;
    }
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceDisabled) return true;
    return isControlDisabled(impl.evaluatedDef.toProxy(rc));
  });
  impl.addCleanup(() => disabledComputed.cleanup());

  // ── disabled → data control
  const disabledPush = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNode);
    if (!dn) return;
    const dc = dn.cursor(rc).control;
    const isDisabled = rc.getValue(disabled);
    ctx.update((wc) => wc.setDisabled(dc, isDisabled));
  });
  impl.addCleanup(() => disabledPush.cleanup());

  // ── touched: push from form state to data control
  const touchedPush = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNode);
    if (!dn) return;
    const dc = dn.cursor(rc).control;
    const t = rc.isTouched(base);
    ctx.update((wc) => wc.setTouched(dc, t));
  });
  impl.addCleanup(() => touchedPush.cleanup());

  // ── touched: pull from data control back to form state
  const touchedPull = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNode);
    if (!dn) return;
    const dc = dn.cursor(rc).control;
    const t = rc.isTouched(dc);
    ctx.update((wc) => wc.setTouched(base, t));
  });
  impl.addCleanup(() => touchedPull.cleanup());

  // ── errors: mirror from data control to form state base
  const errorMirror = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNode);
    if (!dn) {
      ctx.update((wc) => wc.setErrors(base, null));
      return;
    }
    const dc = dn.cursor(rc).control;
    const errors = rc.getErrors(dc);
    ctx.update((wc) => wc.setErrors(base, errors));
  });
  impl.addCleanup(() => errorMirror.cleanup());

  // ── default-value / clearHidden cycle. `defaultValue` is scriptable, so
  // this effect reads through the proxy — a dynamic default propagates
  // here automatically.
  const defaultValueEffect = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNode);
    const def = impl.evaluatedDef.toProxy(rc);
    if (!dn || !isDataControl(def)) return;
    const dc = dn.cursor(rc).control;
    const vis = rc.getValue(visible);
    if (vis === false) {
      if (
        impl.globals.clearHidden &&
        !(def as any).dontClearHidden
      ) {
        ctx.update((wc) => wc.setValue(dc, undefined));
      }
      return;
    }
    const currentValue = rc.getValue(dc);
    const defVal = (def as any).defaultValue;
    if (
      vis &&
      currentValue === undefined &&
      defVal != null &&
      !(def.adornments ?? []).some(
        (a: ControlAdornment) => a.type === ControlAdornmentType.Optional,
      ) &&
      (def as any).renderOptions?.type !== DataRenderType.NullToggle
    ) {
      ctx.update((wc) => wc.setValue(dc, defVal));
    }
  });
  impl.addCleanup(() => defaultValueEffect.cleanup());

  // ── validators: required + dynamic validators from the definition
  setupValidation(
    {
      ctx,
      uniqueId: impl.uniqueId,
      schemaInterface,
      parentDataNode: parent,
      dataNodeControl: dataNode,
      visibleControl: visible,
      nodeOptionsControl: base.fields.nodeOptions,
      runAsync: impl.globals.runAsync,
      addCleanup: (fn) => impl.addCleanup(fn),
    },
    definition,
  );

  // Eagerly initialise children when safe. Nodes with a `childRefId` may
  // introduce recursion, so we only init lazily for those.
  if (!(definition as any).childRefId) {
    impl.ensureChildren();
  }
}

/** Combine two {@link VariablesFunc}s so children inherit parent variables. */
export function combineVariables(
  v1?: VariablesFunc,
  v2?: VariablesFunc,
): VariablesFunc | undefined {
  if (!v1) return v2;
  if (!v2) return v1;
  return (c: ChangeListenerFunc<any>) => ({ ...v1(c), ...v2(c) });
}

/**
 * Implements the "hide display-only" visibility rule: a data control
 * rendered as display-only with no `emptyText` and an empty value should be
 * hidden. Matches the old semantics in
 * `astrolabe-common/forms/core/src/schemaDataNode.ts:hideDisplayOnly`.
 */
function hideDisplayOnly(
  cursor: DataCursor,
  schemaInterface: SchemaInterface,
  definition: ControlDefinition,
): boolean {
  const opts = getDisplayOnlyOptions(definition);
  if (!opts || opts.emptyText) return false;
  const rd = cursor.schema.rd;
  const value = rd.getValue(cursor.control);
  return schemaInterface.isEmptyValue(cursor.field, value);
}


// ── Children lifecycle ─────────────────────────────────────────────

/**
 * Install the reactive children-maintenance effect on a FormStateNode.
 *
 * The effect:
 * 1. Invokes the resolver to get the current `ChildNodeSpec[]` (reads live
 *    data through its {@link ReadContext} — e.g. array elements).
 * 2. Diffs against a child cache keyed by `childKey` for identity stability.
 * 3. Builds the new children array (as base Controls) and writes it to the
 *    `children` Control via {@link WriteContext.updateElements | updateElements}.
 * 4. Cleans up detached children.
 */
function initChildren(impl: FormStateNodeImpl): void {
  const { ctx, base, resolveChildren } = impl;
  const childMap = new Map<string | number, Control<FormStateBaseImpl>>();
  let lastParent: DataNode | undefined;

  const childrenEffect = effect(ctx, (rc) => {
    const specs = resolveChildren(impl, rc);

    // If the data context changed, stale child FormStateNodes would have
    // references to the old parent DataNode. Rebuild from scratch.
    const currentParent = rc.getValue(base.fields.dataNode);
    if (lastParent !== currentParent) {
      childMap.clear();
    }
    lastParent = currentParent;

    const detached: Control<FormStateBaseImpl>[] = [];
    ctx.update((wc) => {
      const next = wc.updateElements(
        base.fields.children,
        (prev) => {
          const wanted: Control<FormStateBaseImpl>[] = [];
          const seen = new Set<string | number>();
          specs.forEach((spec, childIndex) => {
            seen.add(spec.childKey);
            let child = childMap.get(spec.childKey);
            if (child) {
              wc.setValue(child.fields.childIndex, childIndex);
            } else {
              child = createChildNode(impl, spec, childIndex);
              childMap.set(spec.childKey, child);
            }
            wanted.push(child);
          });
          // Anything present in prev but not in wanted is detached.
          for (const p of prev) {
            const fs = (p.meta as Record<string, unknown>)[
              FORM_STATE_META_KEY
            ] as FormStateNode | undefined;
            if (fs && !wanted.includes(p)) {
              detached.push(p);
            }
          }
          // Also prune cache entries that weren't seen this round.
          for (const key of [...childMap.keys()]) {
            if (!seen.has(key)) childMap.delete(key);
          }
          return wanted;
        },
      );
      return next;
    });

    for (const d of detached) {
      const fs = (d.meta as Record<string, unknown>)[
        FORM_STATE_META_KEY
      ] as FormStateNode | undefined;
      fs?.cleanup();
    }
  });
  impl.addCleanup(() => childrenEffect.cleanup());
}

/**
 * Instantiate a new child FormStateNode from a {@link ChildNodeSpec} and
 * return its base Control (which is what gets stored as an element of the
 * parent's `children` Control).
 */
function createChildNode(
  parent: FormStateNodeImpl,
  spec: ChildNodeSpec,
  childIndex: number,
): Control<FormStateBaseImpl> {
  const meta: Record<string, any> = {};
  const scope: CleanupScope = {
    addCleanup: (fn) => parent.addCleanup(fn),
  };
  const init = spec.create(scope, meta);
  const childNodeOptions: FormNodeOptions = {
    forceHidden: false,
    forceDisabled: false,
    forceReadonly: false,
    variables: combineVariables(
      parent.base.fieldsNow.nodeOptions?.valueNow?.variables,
      init.variables,
    ),
  };
  const childImpl = new FormStateNodeImpl(
    parent.ctx,
    spec.childKey,
    meta,
    init.definition ?? groupedFallbackDefinition(),
    init.node === undefined ? parent.form : init.node,
    childNodeOptions,
    parent.globals,
    init.parent ?? parent.parent,
    parent,
    childIndex,
    init.resolveChildren,
  );
  return childImpl.base;
}

/** A do-nothing group definition, used when a child spec provides none. */
function groupedFallbackDefinition(): ControlDefinition {
  return {
    type: "Group",
    children: [],
  } as unknown as ControlDefinition;
}
