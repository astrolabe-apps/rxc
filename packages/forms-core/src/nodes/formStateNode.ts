import {
  type Control,
  type ControlContext,
  type ReadContext,
  computeInto,
  effect,
  untrackedRead,
  type ControlFields,
} from "@rx-controls/core";
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
 * The root node sources its definition reactively from `formNode`. Edits
 * to the underlying `Control<ControlDefinition>` (for reactive form trees
 * created via `createReactiveFormTree`) propagate through the FormStateNode:
 * `evaluatedDef` is rebuilt, validators re-register, visibility/readonly/
 * disabled cascade re-evaluate.
 */
export function createFormStateNode(
  ctx: ControlContext,
  formNode: FormNode,
  parent: DataNode,
  options: FormGlobalOptions,
  nodeOptions: FormNodeOptions = {},
  /**
   * Optional override for the root node's definition. When set, this shadows
   * `formNode.cursor(rc).definition` for the *root only* — children still
   * resolve from `formNode`'s cursor. Useful when you need to render a
   * subtree (e.g. the columns of a DataGrid wrapped in a Contents group as
   * an external-edit draft) without grafting a synthetic FormNode.
   */
  staticDef: ControlDefinition | null = null,
): FormStateNode {
  const resolved: FormGlobalOptions = {
    ...options,
    schemaInterface: options.schemaInterface ?? defaultSchemaInterface,
  };
  return new FormStateNodeImpl(
    ctx,
    "ROOT",
    {},
    staticDef,
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
  fieldOptions: FieldOption[] | undefined;
  dataNode: DataNode | undefined;
  childIndex: number;
  nodeOptions: FormNodeOptions;
  busy: boolean;
  /** Number of active {@link FormStateNode.acquireDisabler} holds on this
   * node. The disabled cascade treats `disablerCount > 0` as forced
   * disabled (alongside `nodeOptions.forceDisabled`), so multiple
   * concurrent disablers compose without clobbering each other. */
  disablerCount: number;
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
  /**
   * Holds the current {@link EvaluatedDefinition} — rebuilt by an effect
   * inside {@link initFormState} whenever the definition identity changes.
   * Null only during the brief window before the effect first runs.
   */
  evalDefControl!: Control<EvaluatedDefinition | null>;

  ui: FormNodeUi = noopUi;

  private _childrenInitialized = false;
  private _cleanups: Array<() => void> = [];

  constructor(
    public readonly ctx: ControlContext,
    public childKey: string | number,
    public meta: Record<string, any>,
    private readonly staticDef: ControlDefinition | null,
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
        fieldOptions: undefined,
        dataNode: undefined,
        childIndex,
        nodeOptions,
        busy: false,
        disablerCount: 0,
      },
      // Errors are mirrored onto `base` from the data control; they must not
      // be dropped when `base`'s own value changes (notably when children are
      // appended after validation has already published).
      { keepErrors: true },
    );
    this.base = base;
    base.meta[FORM_STATE_META_KEY] = this;
    this.resolveChildren = resolveChildren ?? globals.resolveChildren;

    initFormState(this, parentNode);
  }

  get uniqueId(): string {
    return this.base.uniqueId.toString();
  }

  /**
   * Authoritative definition source. For synthesized children (option
   * expansion, array-element fallback) returns the static snapshot. For
   * nodes bound to a {@link FormNode} reads via `form.cursor(rc).definition`
   * — reactive form trees propagate through here. Otherwise returns a
   * fallback empty group. The returned object is **not** wrapped by the
   * script proxy; use {@link FormState.definition} for the evaluated view.
   */
  unresolved(rc: ReadContext): ControlDefinition {
    return (
      this.staticDef ??
      this.form?.cursor(rc).definition ??
      groupedFallbackDefinition()
    );
  }

  get schemaInterface(): SchemaInterface {
    return this.globals.schemaInterface ?? defaultSchemaInterface;
  }

  getState(rc: ReadContext): FormState {
    return new FormStateView(this, rc);
  }

  getChildren(rc: ReadContext): FormStateNode[] {
    this.ensureChildren();
    const childrenControl = this.base.fields.children;
    const elems = rc.getElements(childrenControl);
    return elems.map((el) => el.meta[FORM_STATE_META_KEY] as FormStateNode);
  }

  setTouched(touched: boolean, notChildren?: boolean): void {
    this.ctx.update((wc) => wc.setTouched(this.base, touched, notChildren));
  }

  validate(): boolean {
    for (const child of this.getChildren(untrackedRead)) {
      child.validate();
    }
    const dn = this.base.existingFields.dataNode?.valueNow as DataNode | undefined;
    if (dn) {
      this.ctx.update((wc) => wc.validate(dn.cursor(untrackedRead).control));
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
    for (const child of this.getChildren(untrackedRead)) {
      child.cleanup();
    }
    for (const fn of this._cleanups) fn();
    this._cleanups = [];
    // Drop references held via meta so controls can be GC'd.
    delete this.base.meta[FORM_STATE_META_KEY];
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

  acquireDisabler(type: ControlDisableType): () => void {
    if (type === "None" || !type) return () => {};
    let target: FormStateNodeImpl = this;
    if (type !== "Self") {
      while (target.parentNode) {
        target = target.parentNode as FormStateNodeImpl;
      }
    }
    const counter = target.base.fields.disablerCount;
    target.ctx.update((wc) =>
      wc.updateValue(counter, (n) => n + 1),
    );
    let released = false;
    return () => {
      if (released) return;
      released = true;
      target.ctx.update((wc) =>
        wc.updateValue(counter, (n) => Math.max(0, n - 1)),
      );
    };
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
  /**
   * Cached `ControlFields` view of the node's `base` control. Each field
   * accessor reads its value through `rc` on the matching child control,
   * registering exactly one Value/Structure dependency per call.
   */
  private readonly baseFields: ControlFields<FormStateBaseImpl>;

  constructor(
    private readonly impl: FormStateNodeImpl,
    private readonly rc: ReadContext,
  ) {
    this.baseFields = impl.base.fields;
  }

  get dataNode(): DataNode | undefined {
    return this.rc.getValue(this.baseFields.dataNode);
  }

  get data(): Control<unknown> | undefined {
    const dn = this.dataNode;
    return dn?.cursor(this.rc).control;
  }

  get field() {
    const dn = this.dataNode;
    return dn?.cursor(this.rc).field;
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

  get childIndex(): number {
    return this.rc.getValue(this.baseFields.childIndex);
  }

  get busy(): boolean {
    return this.rc.getValue(this.baseFields.busy);
  }

  get definition(): ControlDefinition {
    // Construct a definition view bound to this.rc so renderer reads of
    // non-scripted fields (title, required, etc.) subscribe correctly.
    const base = this.impl.unresolved(this.rc);
    const evalDef = this.rc.getValue(this.impl.evalDefControl);
    return evalDef ? evalDef.wrap(this.rc, base) : base;
  }

  get fieldOptions(): FieldOption[] | undefined {
    return this.rc.getValue(this.baseFields.fieldOptions);
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

  get meta(): Record<string, any> {
    return this.impl.meta;
  }

  // ── FormNodeOptions mirror — read the record once per access so
  // multiple force-flag reads share a single Value subscription.
  private get nodeOpts(): FormNodeOptions {
    return this.rc.getValue(this.baseFields.nodeOptions);
  }

  get variables(): VariablesFunc | undefined {
    return this.nodeOpts.variables;
  }
  get forceReadonly() {
    return this.nodeOpts.forceReadonly;
  }
  get forceDisabled() {
    return this.nodeOpts.forceDisabled;
  }
  get forceHidden() {
    return this.nodeOpts.forceHidden;
  }
}

// ── Wiring ─────────────────────────────────────────────────────────

/**
 * Set up computed properties and sync effects for a FormStateNode.
 *
 * The definition is sourced reactively from the node's `form` (a persistent
 * {@link FormNode}) — for reactive form trees, property reads through the
 * FormNode's cursor subscribe via their ReadContext, so edits to the
 * underlying `Control<ControlDefinition>` trigger re-evaluation.
 *
 * The {@link EvaluatedDefinition} (override controls + script effects) has
 * an effect-driven lifecycle: it is rebuilt whenever the definition identity
 * changes, with the previous iteration's cleanups run first. Downstream
 * computeds read the current evalDef reactively via `impl.evalDefControl`.
 */
function initFormState(
  impl: FormStateNodeImpl,
  parentNode: FormStateNode | undefined,
): void {
  const { ctx, base, parent } = impl;
  const { dataNode, visible, readonly, disabled } = base.fields;
  const schemaInterface = impl.schemaInterface;

  // ── dataNode: resolve the definition's field path against the parent.
  // Reads the definition reactively so changes to `field` / `compoundField`
  // re-trigger path resolution.
  const dataNodeComputed = computeInto(ctx, dataNode, (rc) => {
    const def = impl.unresolved(rc);
    const fieldRef = formFieldPath(def);
    if (fieldRef === undefined) return undefined;
    const parentCursor = parent.cursor(rc);
    const resolved = dataRef(parentCursor, fieldRef);
    return resolved?.node;
  });
  impl.addCleanup(() => dataNodeComputed.cleanup());

  // ── evaluatedDef lifecycle — rebuild on definition identity changes.
  //
  // The effect's tracked reads (via `impl.unresolved(rc)` + what the walker
  // reads on the proxy) determine when it re-fires. When it does, the
  // previous iteration's cleanup tears down old override controls / script
  // effects, then a fresh EvaluatedDefinition is constructed and published
  // to `evalDefControl` for downstream readers.
  const evalDefControl = ctx.newControl<EvaluatedDefinition | null>(null);
  impl.evalDefControl = evalDefControl;
  const evalDefEffect = effect(ctx, (rc) => {
    const def = impl.unresolved(rc);
    const legacyMap = buildLegacyScripts(def);
    const getScripts: ScriptProvider = (target, path) => {
      const explicit =
        ((target as unknown as Record<string, unknown>)?.["$scripts"] as Record<
          string,
          import("../json").EntityExpression
        >) ?? {};
      const legacy = legacyMap.get(path) ?? {};
      return { ...legacy, ...explicit };
    };
    const initialData =
      (base.existingFields.dataNode?.valueNow as DataNode | undefined) ?? parent;
    const cleanups: Array<() => void> = [];
    const variables = rc.getValue(base.fields.nodeOptions).variables;
    const evalDef = createEvaluatedDefinition(
      def,
      ctx,
      initialData,
      schemaInterface,
      impl.globals.runAsync,
      variables,
      (fn) => cleanups.push(fn),
      getScripts,
      impl.globals.extraRenderOptionFields ?? [],
    );
    ctx.update((wc) => wc.setValue(evalDefControl, evalDef));
    return () => {
      for (const c of cleanups) c();
    };
  });
  impl.addCleanup(() => evalDefEffect.cleanup());

  // Helper: rc-bound proxy view of the current evaluated definition. The
  // caller's `rc` is used both for the fresh base definition read and for
  // the override-proxy wrapping, so renderer subscriptions register on
  // non-scripted fields (title, required, etc.) too.
  const proxyFor = (rc: ReadContext): ControlDefinition => {
    const base = impl.unresolved(rc);
    const evalDef = rc.getValue(evalDefControl);
    return evalDef ? evalDef.wrap(rc, base) : base;
  };

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
  const visibleComputed = computeInto(ctx, visible, (rc) => {
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceHidden) return false;
    if (parentNode) {
      const parentVisible = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.visible,
      );
      if (!parentVisible) return parentVisible;
    }
    const dn = rc.getValue(dataNode);
    const def = proxyFor(rc);
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
  const fieldOptionsControl = base.fields.fieldOptions;
  const fieldOptionsComputed = computeInto(ctx, fieldOptionsControl, (rc) => {
    const dn = rc.getValue(dataNode);
    if (!dn) return undefined;
    const dc = dn.cursor(rc);
    const all = schemaInterface.getDataOptions(dc);
    const def = proxyFor(rc);
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
  });
  impl.addCleanup(() => fieldOptionsComputed.cleanup());

  // ── readonly cascade — `readonly` may be scripted, so read through proxy.
  const readonlyComputed = computeInto(ctx, readonly, (rc) => {
    if (parentNode) {
      const pr = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.readonly,
      );
      if (pr) return true;
    }
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceReadonly) return true;
    return isControlReadonly(proxyFor(rc));
  });
  impl.addCleanup(() => readonlyComputed.cleanup());

  // ── disabled cascade — `disabled` may be scripted, so read through proxy.
  const disabledComputed = computeInto(ctx, disabled, (rc) => {
    if (parentNode) {
      const pd = rc.getValue(
        (parentNode as FormStateNodeImpl).base.fields.disabled,
      );
      if (pd) return true;
    }
    const opts = rc.getValue(base.fields.nodeOptions);
    if (opts.forceDisabled) return true;
    if (rc.getValue(base.fields.disablerCount) > 0) return true;
    return isControlDisabled(proxyFor(rc));
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
    // Only sync the immediate form state node from the control. The child
    // FormStateNode bases are elements of this base's `children` control, so
    // a recursive setTouched would cascade into every sibling subtree — and
    // each sibling's touchedPush would then mark its *data* control touched,
    // surfacing errors form-wide from one field's blur. (Port of legacy
    // formStateNode "Dont recurse the touched flag".)
    ctx.update((wc) => wc.setTouched(base, t, true));
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
    const def = proxyFor(rc);
    if (!dn || !isDataControl(def)) return;
    const dc = dn.cursor(rc).control;
    const vis = rc.getValue(visible);
    if (vis === false) {
      if (impl.globals.clearHidden && !def.dontClearHidden) {
        ctx.update((wc) => wc.setValue(dc, undefined));
      }
      return;
    }
    const currentValue = rc.getValue(dc);
    const defVal = def.defaultValue;
    if (
      vis &&
      currentValue === undefined &&
      defVal != null &&
      !(def.adornments ?? []).some(
        (a: ControlAdornment) => a.type === ControlAdornmentType.Optional,
      ) &&
      def.renderOptions?.type !== DataRenderType.NullToggle
    ) {
      ctx.update((wc) => wc.setValue(dc, defVal));
    }
  });
  impl.addCleanup(() => defaultValueEffect.cleanup());

  // ── validators: required + dynamic validators from the definition.
  // `impl.unresolved` is invoked inside `setupValidation`'s outer effect so
  // the validator set reacts to `def.required` / `def.validators[]` changes.
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
    (rc) => impl.unresolved(rc),
  );

  // Eagerly initialise children when safe. Nodes with a `childRefId` may
  // introduce recursion, so we only init lazily for those. Reading the
  // snapshot via `untrackedRead` is intentional — we only care about the
  // structural childRefId at construction time; later childRefId edits
  // would require a different mechanism (not in scope here).
  if (!impl.unresolved(untrackedRead).childRefId) {
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
  return (rc) => ({ ...v1(rc), ...v2(rc) });
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
      const next = wc.updateElements(base.fields.children, (prev) => {
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
          const fs = p.meta[FORM_STATE_META_KEY] as FormStateNode | undefined;
          if (fs && !wanted.includes(p)) {
            detached.push(p);
          }
        }
        // Also prune cache entries that weren't seen this round.
        for (const key of [...childMap.keys()]) {
          if (!seen.has(key)) childMap.delete(key);
        }
        return wanted;
      });
      return next;
    });

    for (const d of detached) {
      const fs = d.meta[FORM_STATE_META_KEY] as FormStateNode | undefined;
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
      parent.base.fields.nodeOptions?.valueNow?.variables,
      init.variables,
    ),
  };
  // A spec carrying `definition` means its own-def is a static snapshot
  // (synthesized for option/array-element children). With no `definition`,
  // the child sources its own-def reactively from `init.node ?? parent.form`.
  const childForm = init.node === undefined ? parent.form : init.node;
  const staticDef = init.definition ?? (childForm ? null : groupedFallbackDefinition());
  const childImpl = new FormStateNodeImpl(
    parent.ctx,
    spec.childKey,
    meta,
    staticDef,
    childForm,
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
  };
}
