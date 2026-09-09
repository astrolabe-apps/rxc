import {
  untrackedRead,
  type Control,
  type ReadContext,
} from "@rxc/controls-core";
import {
  ControlDefinitionType,
  createDataNode,
  createFormStateNode,
  GroupRenderType,
  isDataControl,
  type ControlDefinition,
  type DataNode,
  type FormNode,
  type FormStateNode,
} from "@rxc/forms-core";
import type { ActionRendererProps } from "./types";

/**
 * Optional overrides for how the draft FormStateNode is built. Both
 * default to "auto-detect from the array's form" — sufficient for
 * conventional array renderers (single-child element template).
 *
 * DataGrid-style renderers, where the array's children are columns rather
 * than a per-element template, can supply both: pass the array's own
 * `FormNode` so children resolve to the columns, plus a `Contents` group
 * `elementDefinition` so the draft renders the columns inline rather than
 * recursively as another grid.
 */
export interface ExternalEditOptions {
  /** Override the FormNode used as the draft's root. */
  elementForm?: FormNode;
  /** Override the draft root's definition (shadows the form node's own). */
  elementDefinition?: ControlDefinition;
}

/**
 * One staged-edit action (Cancel / confirm), produced by the controller
 * and carried on the {@link ExternalEditSession}. Mirrors legacy's
 * `ExternalEditAction` stored in `getExternalEditData(control).fields.actions`
 * — the modal host renders these rather than hardcoding its own buttons,
 * applying validation to the confirm action per {@link dontValidate}
 * (legacy `applyValidation`).
 */
export interface ExternalEditAction {
  /** When set, the host renders {@link action} as-is (no draft validation
   *  before its `onClick`). Cancel sets this; the confirm action does not. */
  dontValidate?: boolean;
  /** The props passed to `<Action>` — `onClick` performs the raw
   *  commit/cancel; the host wraps it with validation when `!dontValidate`. */
  action: ActionRendererProps;
}

/**
 * Staged-edit session for one array. The {@link draftForm} is a standalone
 * {@link FormStateNode} subtree rooted on the array's element schema/form
 * and bound to a fresh {@link draft} control — modifications never touch
 * the source array until the confirm {@link actions | action} commits.
 */
export interface ExternalEditSession {
  /** `"add"` stages a new element; `"edit"` stages a snapshot of `arr[index]`. */
  mode: "add" | "edit";
  /** Target element index for `edit`; for `add`, the length at begin time
   *  (informational only — Apply pushes to the live end of the array). */
  index: number;
  /** The transient draft value Control. */
  draft: Control<unknown>;
  /** The standalone draft FormStateNode for rendering. */
  draftForm: FormStateNode;
  /** Cancel + confirm actions for the modal host to render (legacy
   *  `extData.fields.actions`). Cancel first, then confirm. */
  actions: ExternalEditAction[];
}

export interface ExternalEditController {
  /**
   * Reactive read of the current session. Returns `null` when no edit is
   * in progress. Must be called from a `ReadContext` to subscribe to
   * begin/apply/cancel transitions.
   */
  session(rc: ReadContext): ExternalEditSession | null;
  /**
   * Begin staging a new array element. `initialValue` defaults to `null`,
   * matching the legacy `wc.addElement(arr, null)` pattern that lets
   * defaultValue scripts populate the draft.
   */
  beginAdd(initialValue?: unknown): void;
  /**
   * Begin staging an edit of `arr[index]`. Snapshots the live value
   * (structural clone) so subsequent draft writes don't affect the live
   * element until Apply.
   */
  beginEdit(index: number): void;
  /**
   * Commit the draft.
   *
   * - `add`: appends the draft value via `wc.addElement(arr, value)`.
   * - `edit`: writes the draft value over the live element at the
   *   originally-targeted index (no-op if the index is now out of range
   *   — defensive against the array being mutated mid-session).
   *
   * Validates the draft form first unless `dontValidate` is set; on
   * validation failure marks every draft node touched (so error messages
   * surface) and returns `false`. Returns `true` on success.
   */
  apply(options?: { dontValidate?: boolean }): boolean;
  /** Discard the draft and clear the session. */
  cancel(): void;
}

const META_KEY = "$externalEdit";

/**
 * Per-array staged-edit controller. Returns the same controller instance
 * for any `FormStateNode` bound to the same underlying array `Control`
 * — keyed by `arrayControl.meta[META_KEY]` so a `renderType: Array`
 * control and its sibling `renderType: ArrayElement` modal host (each
 * a separate FormStateNode) share **one** controller and **one**
 * staged-edit session. Without this, `beginAdd` on the Array node would
 * write to a session the sibling host never reads.
 *
 * Despite being called from renderer bodies, this is **not** a React
 * hook — it calls no hooks and is just a memoized get-or-create on the
 * array Control's meta. It's safe to call conditionally; do not rename
 * it to `use*`.
 *
 * `arrayNode` must be the {@link FormStateNode} for an array (its
 * `state.field?.collection === true`). Calling on a non-array node
 * silently no-ops at begin time (the array Control resolution returns
 * `undefined`).
 *
 * Typical use from a renderer that calls `useControls()`:
 *
 * ```ts
 * const edit = getExternalEdit(arrayNode);
 * const session = edit.session(rc);
 * // ...
 * <button onClick={() => edit.beginAdd()}>Add</button>
 * {session ? <DraftDialog draftForm={session.draftForm}
 *   onApply={() => edit.apply()} onCancel={() => edit.cancel()} /> : null}
 * ```
 */
export function getExternalEdit(
  arrayNode: FormStateNode,
  options: ExternalEditOptions = {},
): ExternalEditController {
  // Different override shapes need different controller instances — cache
  // per (arrayControl, elementForm, elementDefinition) triple via a
  // composite meta key on the SHARED array Control. Two FormStateNodes
  // bound to the same field will resolve to the same `arrayControl` here
  // and so see the same cached controller.
  const overrideKey =
    options.elementForm || options.elementDefinition
      ? `${META_KEY}/${options.elementForm?.id ?? "_"}/${
          options.elementDefinition ? "def" : "_"
        }`
      : META_KEY;

  // Resolve the underlying array Control — the shared key between
  // sibling renderers. Two FormStateNodes bound to the same array field
  // resolve to the same `Control` here, so the controller cached on the
  // Control's `meta` is shared between them.
  const dn = arrayNode.getState(untrackedRead).dataNode;
  const arrayControl = dn?.cursor(untrackedRead).control as
    | Control<unknown>
    | undefined;
  const metaHost = (arrayControl?.meta ?? {}) as Record<string, unknown>;

  const cached = metaHost[overrideKey] as ExternalEditController | undefined;
  if (cached) return cached;

  return ((): ExternalEditController => {
    const ctx = arrayNode.ctx;
    const sessionControl = ctx.newControl<ExternalEditSession | null>(null);

    function getArrayControl(): Control<unknown[]> | undefined {
      const dn = arrayNode.getState(untrackedRead).dataNode;
      if (!dn) return undefined;
      return dn.cursor(untrackedRead).control as Control<unknown[]>;
    }

    function getElementSchemaNode() {
      // The array's own SchemaNode is reused for elements — see
      // `dataNode.ts::childElement` which calls
      // `createDataNode(schemaNode, elemControl, node, index)`.
      const dn = arrayNode.getState(untrackedRead).dataNode;
      if (!dn) return undefined;
      return dn.cursor(untrackedRead).schema.node;
    }

    // Resolve the draft's root FormNode and the definition to root it with.
    //
    // - Explicit `options.elementForm` wins (back-compat for callers that
    //   pass a custom root, e.g. older DataGrid wiring / unit tests).
    // - Single-child array: the lone child is the element template — root on
    //   it directly (its own def renders the template).
    // - Multi-child array (e.g. DataGrid columns): rooting on the array's own
    //   form would make the draft re-dispatch to the array's own collection
    //   renderer (a nested Array/DataGrid bound to one element). Default the
    //   root definition to a `Contents` group so the children (columns) render
    //   inline. Children still resolve from `arrayForm`.
    function getElementRoot():
      | { form: FormNode; def: ControlDefinition | null }
      | undefined {
      const explicitDef = options.elementDefinition ?? null;
      if (options.elementForm) {
        return { form: options.elementForm, def: explicitDef };
      }
      const arrayForm = arrayNode.form;
      if (!arrayForm) return undefined;
      const children = arrayForm.cursor(untrackedRead).children;
      if (children.length === 1) {
        return { form: children[0].node, def: explicitDef };
      }
      return {
        form: arrayForm,
        def:
          explicitDef ??
          ({
            type: ControlDefinitionType.Group,
            groupOptions: { type: GroupRenderType.Contents },
          } as ControlDefinition),
      };
    }

    function disposeCurrent(current: ExternalEditSession | null) {
      if (current) current.draftForm.cleanup();
    }

    // Cancel + confirm actions staged onto the session, mirroring legacy's
    // `getExternalEditData(control).fields.actions`. `onClick` performs the
    // RAW commit/cancel; the modal host applies draft validation to the
    // confirm action (the one without `dontValidate`) via `applyValidation`.
    // The confirm action's id/text follow legacy: an `add` session uses the
    // array's `addActionId`/`addText` ("add"/"Add"); an `edit` session uses
    // "apply"/"Apply".
    function buildActions(mode: "add" | "edit"): ExternalEditAction[] {
      const arrayDef = arrayNode.getState(untrackedRead).definition;
      const arrayRenderOpts = isDataControl(arrayDef)
        ? (arrayDef.renderOptions as
            | { addActionId?: string | null; addText?: string | null }
            | undefined)
        : undefined;
      const isAdd = mode === "add";
      return [
        {
          dontValidate: true,
          action: {
            actionId: "cancel",
            actionText: "Cancel",
            onClick: () => doCancel(),
          },
        },
        {
          action: {
            actionId: isAdd ? arrayRenderOpts?.addActionId || "add" : "apply",
            actionText: isAdd ? arrayRenderOpts?.addText || "Add" : "Apply",
            onClick: () => {
              doApply({ dontValidate: true });
            },
          },
        },
      ];
    }

    function beginSession(mode: "add" | "edit", index: number, value: unknown) {
      const elementSchema = getElementSchemaNode();
      const root = getElementRoot();
      if (!elementSchema || !root) return;

      const draft = ctx.newControl<unknown>(value);
      const draftDataNode: DataNode = createDataNode(
        elementSchema,
        draft,
        undefined,
        // `elementIndex` must be a number (not undefined) so the default
        // child resolver treats this as an element body, not an array
        // container that needs expanding. The numeric value is otherwise
        // not consulted for standalone drafts.
        0,
      );
      const draftForm = createFormStateNode(
        ctx,
        root.form,
        draftDataNode,
        arrayNode.globals,
        undefined,
        root.def,
      );

      const next: ExternalEditSession = {
        mode,
        index,
        draft,
        draftForm,
        actions: buildActions(mode),
      };
      ctx.update((wc) => {
        const prev = sessionControl.valueNow;
        disposeCurrent(prev);
        wc.setValue(sessionControl, next);
      });
    }

    function doApply(options?: { dontValidate?: boolean }): boolean {
      const session = sessionControl.valueNow;
      if (!session) return false;
      const dontValidate = options?.dontValidate === true;
      if (!dontValidate) {
        if (!session.draftForm.validate()) {
          session.draftForm.setTouched(true);
          return false;
        }
      }
      return commit(session.draft.valueNow, session);
    }

    function doCancel() {
      ctx.update((wc) => {
        const prev = sessionControl.valueNow;
        disposeCurrent(prev);
        wc.setValue(sessionControl, null);
      });
    }

    function commit(value: unknown, session: ExternalEditSession): boolean {
      const arr = getArrayControl();
      if (!arr) return false;
      ctx.update((wc) => {
        if (session.mode === "add") {
          wc.addElement(arr, value);
        } else {
          const elems = arr.elementsNow;
          if (session.index >= 0 && session.index < elems.length) {
            wc.setValue(elems[session.index] as Control<unknown>, value);
          }
        }
        disposeCurrent(session);
        wc.setValue(sessionControl, null);
      });
      return true;
    }

    const controller: ExternalEditController = {
      session(rc) {
        return rc.getValue(sessionControl);
      },
      beginAdd(initialValue = null) {
        const arr = getArrayControl();
        const len = arr ? arr.elementsNow.length : 0;
        beginSession("add", len, initialValue);
      },
      beginEdit(index) {
        const arr = getArrayControl();
        if (!arr) return;
        const elems = arr.elementsNow;
        if (index < 0 || index >= elems.length) return;
        const live = (elems[index] as Control<unknown>).valueNow;
        // Structural clone so draft mutations on compound values don't
        // alias back into the live element.
        const snapshot =
          live == null || typeof live !== "object" ? live : structuredClone(live);
        beginSession("edit", index, snapshot);
      },
      apply: doApply,
      cancel: doCancel,
    };

    if (arrayControl) {
      metaHost[overrideKey] = controller;
    }
    return controller;
  })();
}
