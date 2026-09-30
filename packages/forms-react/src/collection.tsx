import {
  useEffect,
  useId,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { untrackedRead } from "@rx-controls/core";
import {
  Reactive,
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import type { FieldProps, FieldRenderProps, Validator } from "./field.js";
import { getProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import {
  FormScopeProvider,
  useBoundScope,
  type ScopeState,
} from "./scope.js";
import {
  hiddenPending,
  useDefaultValue,
  useFieldValidation,
  useMirror,
} from "./fieldValidation.js";
import { useValidationScope } from "./validationScope.js";
import {
  bailout,
  boundaryName,
  boundaryState,
  designChrome,
  extraProps,
  fieldContractKeys,
  republish,
  resolveImpl,
} from "./boundaryParts.js";

/**
 * Add, remove, move and edit for one array, with the bounds its length limits
 * imply. The collection boundary builds these with its own scope, so inside a
 * locked region every `can*` is `false`.
 *
 * @group Authoring
 */
export interface ArrayActions {
  /** How many elements there are now. */
  length: number;
  /** Not locked, and below `maxLength`. */
  canAdd: boolean;
  /** Not locked, and above `minLength`. */
  canRemove: boolean;
  /** Not locked. */
  canEdit: boolean;
  /** Insert an element — at the end, or at `index`. */
  add(value?: unknown, index?: number): void;
  /** Remove the element at `index`. */
  remove(index: number): void;
  /** Move the element at `from` to `to`. */
  move(from: number, to: number): void;
  /**
   * Begin a staged edit of one element: a draft copy that a dialog elsewhere
   * edits and then applies or cancels. See {@link getExternalEdit}. The session
   * ends by itself if this collection locks or hides while it is open.
   */
  edit(index: number): void;
}

/**
 * What an author writes on a collection: a field over an array, whose rows are
 * a render prop.
 *
 * @group Authoring
 */
export interface CollectionProps<T> extends FieldProps<T[]> {
  /**
   * One row, given its element's control. Each row renders in its own tracking
   * window, so editing one element re-renders that row and nothing else.
   * `actions` are this collection's own, scope-aware set.
   */
  children: (
    item: Control<T>,
    index: number,
    actions: ArrayActions,
  ) => ReactNode;
  /** Shown when there are no elements. */
  empty?: ReactNode;
  /** The fewest elements allowed. Registered as a validator on the array itself. */
  minLength?: number;
  /** The most elements allowed. Registered as a validator on the array itself. */
  maxLength?: number;
}

/**
 * One row, as the implementation sees it: the author's row, already rendered
 * in its own tracking window, plus what chrome on a row needs — a remove
 * column, an Edit button.
 *
 * @group Implementations
 */
export interface CollectionElement<T> {
  /** A stable key: the element control's `uniqueId`, not its index. */
  key: number;
  /** Its position now. */
  index: number;
  /** The element's control. */
  field: Control<T>;
  /** The author's row. */
  node: ReactNode;
}

/**
 * What a collection implementation receives. The three things easy to get
 * wrong — subscribing to structure only, a tracking window per row, keying by
 * `uniqueId` — are done before it sees them.
 *
 * @group Implementations
 */
export interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  /** The rows. */
  elements: CollectionElement<T>[];
  /** This collection's actions, for an Add button or per-row chrome. */
  actions: ArrayActions;
  /** Shown when there are no elements. */
  empty?: ReactNode;
}

/**
 * What a collection boundary draws with: a component of its own, or a
 * registry slot.
 *
 * @group Extensions
 */
export type CollectionImplSource<T, P extends object> =
  | ComponentType<CollectionRenderProps<T> & P>
  | RegistrySlot;

/**
 * Build a collection component. Everything {@link fieldRenderer} does — on the
 * array itself, so a length validator and `clearHidden` reach it — plus the
 * three things an implementation must not be trusted to redo: subscribe to
 * structure only, give every row its own tracking window, and key rows by
 * their control's `uniqueId`.
 *
 * @group Extensions
 */
export function collectionRenderer<T, P extends object = {}>(
  source: CollectionImplSource<T, P>,
): <V extends T>(props: CollectionProps<V> & P) => Rendered {
  function CollectionBoundary(props: CollectionProps<T> & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const autoId = useId();
    const { field: control, dontClearHidden, validate, children } = props;
    const { empty, minLength, maxLength } = props;
    const id = props.id ?? autoId;

    const scope = useBoundScope(props);
    const presence = scope.presence(rc);
    const required = getProp(rc, props.required) ?? false;
    const requiredMessage =
      getProp(rc, props.requiredMessage) ?? "Please add at least one";

    // The length bounds are a validator on the array itself, keyed `length`.
    const validators = useMemo(() => {
      const base: Record<string, Validator<T[]>> =
        typeof validate === "function"
          ? { default: validate }
          : { ...(validate ?? {}) };
      if (minLength !== undefined || maxLength !== undefined)
        base.length = lengthValidator<T>({ minLength, maxLength });
      return base;
    }, [validate, minLength, maxLength]);

    const cfg = useMirror({
      active: presence !== "hidden" && !hiddenPending(rc, props.hidden),
      required,
      requiredMessage,
    });
    const vscope = useValidationScope();
    const verdict = useControl<unknown>(undefined);
    useFieldValidation(control, validators, cfg, vscope, id, verdict);
    useEffect(
      () => vscope?.register(verdict, control),
      [vscope, verdict, control],
    );

    // clearHidden reaches the array itself, not only its elements' fields.
    const clear = presence === "hidden" && scope.clearHidden && !dontClearHidden;
    useEffect(() => {
      if (clear)
        ctx.update((wc) => wc.setValue(control, undefined as unknown as T[]));
    }, [clear, control, ctx]);
    useDefaultValue(control, props.defaultValue, scope, true, props.hidden);

    const state = boundaryState(rc, control as Control<unknown>, scope);
    const own = [...new Set(Object.values(rc.getErrors(verdict)).filter(Boolean))];

    // The boundary's own actions know its scope: a locked region reports
    // every `can*` false, and `edit` stamps the session with this boundary.
    const actions = actionsFor(rc, ctx, control, { minLength, maxLength, scope }, autoId);

    // A staged edit this boundary began ends when the boundary locks or
    // hides. Judged here, in the render that observes the lock however it
    // arrives — a control write or a React prop.
    const endsEdits = state.disabled || state.readOnly || presence === "hidden";
    useEffect(() => {
      if (!endsEdits) return;
      const edit = peekExternalEdit(control);
      if (edit && edit.session(untrackedRead)?.origin === autoId) edit.cancel();
    }, [endsEdits, control, autoId]);

    // Structure only: adding or removing re-renders the list, editing one
    // element re-renders that element's own tracking window.
    const elementControls = rc.isNull(control) ? [] : rc.getElements(control);
    const elements: CollectionElement<T>[] = elementControls.map(
      (elem, index) => ({
        key: elem.uniqueId,
        index,
        field: elem,
        node: (
          <Reactive key={elem.uniqueId}>
            {() => children(elem, index, actions)}
          </Reactive>
        ),
      }),
    );

    const renderProps: CollectionRenderProps<T> = {
      field: control,
      id,
      label: getProp(rc, props.label),
      required,
      error: state.touched && own.length ? own[0] : undefined,
      helpText: getProp(rc, props.helpText),
      startIcon: getProp(rc, props.startIcon),
      endIcon: getProp(rc, props.endIcon),
      inline: scope.inline,
      className: getProp(rc, props.className),
      labelClassName: getProp(rc, props.labelClassName),
      labelTextClassName: getProp(rc, props.labelTextClassName),
      shellClassName: getProp(rc, props.shellClassName),
      textClassName: getProp(rc, props.textClassName),
      elements,
      actions,
      empty,
    };
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const Visibility = renderers.visibility;
    const body = republish(
      <FormScopeProvider scope={scope}>
        <Impl {...renderProps} {...extraProps(props, collectionContractKeys)} />
      </FormScopeProvider>,
      state.disabled,
      state.readOnly,
    );
    return rendered(
      designChrome(
        <Visibility visible={presence !== "hidden"}>{body}</Visibility>,
        scope.designMode,
      ),
    );
  }
  CollectionBoundary.displayName = boundaryName(
    "CollectionBoundary",
    source as ComponentType<never>,
  );
  return bailout(CollectionBoundary) as unknown as <V extends T>(
    props: CollectionProps<V> & P,
  ) => Rendered;
}

const collectionContractKeys: ReadonlySet<string> = new Set([
  ...fieldContractKeys,
  "children",
  "empty",
  "minLength",
  "maxLength",
]);

/**
 * Bounds and context for {@link arrayActions}.
 *
 * @group Authoring
 */
export interface ArrayActionOptions {
  /** The fewest elements allowed. */
  minLength?: number;
  /** The most elements allowed. */
  maxLength?: number;
  /**
   * The scope whose locks fold into the `can*` flags. Absent for buttons drawn
   * outside any boundary.
   */
  scope?: ScopeState;
}

/**
 * The {@link ArrayActions} for an array, for buttons drawn outside the
 * collection that owns it — a toolbar above a list, say. Takes an `rc` and
 * returns values, with no React involved, so it is not a hook.
 *
 * @group Authoring
 */
export function arrayActions<T>(
  rc: ReadContext,
  ctx: ControlContext,
  control: Control<T[]>,
  options?: ArrayActionOptions,
): ArrayActions {
  return actionsFor(rc, ctx, control, options ?? {}, undefined);
}

/** `arrayActions`, with the boundary's token for the sessions it begins. */
function actionsFor<T>(
  rc: ReadContext,
  ctx: ControlContext,
  control: Control<T[]>,
  options: ArrayActionOptions,
  origin: unknown,
): ArrayActions {
  const length = rc.isNull(control) ? 0 : rc.getElements(control).length;
  const { minLength, maxLength, scope } = options;
  const locked =
    rc.isDisabled(control) ||
    (scope ? scope.disabled(rc) || scope.readOnly(rc) : false);
  return {
    length,
    canAdd: !locked && (maxLength === undefined || length < maxLength),
    canRemove: !locked && (minLength === undefined || length > minLength),
    canEdit: !locked,
    add: (value, index) =>
      ctx.update((wc) => wc.addElement(control, value as T, index)),
    remove: (index) => ctx.update((wc) => wc.removeElement(control, index)),
    move: (from, to) =>
      ctx.update((wc) =>
        wc.updateElements(control, (elems) => {
          const next = elems.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
        }),
      ),
    edit: (index) => editController(ctx, control).beginEdit(index, origin),
  };
}

/** The `Length` bounds as a validator on the array. */
function lengthValidator<T>(bounds: {
  minLength?: number;
  maxLength?: number;
}): Validator<T[]> {
  return (v) => {
    const n = v?.length ?? 0;
    if (bounds.minLength !== undefined && n < bounds.minLength)
      return `At least ${bounds.minLength} required`;
    if (bounds.maxLength !== undefined && n > bounds.maxLength)
      return `At most ${bounds.maxLength} allowed`;
    return null;
  };
}

/**
 * An element being edited in a staged session.
 *
 * @group Authoring
 */
export interface EditSession<T> {
  /** Which element. */
  index: number;
  /** A copy of it — an ordinary control. Nothing reaches the array until {@link ExternalEdit.apply}. */
  draft: Control<T>;
}

/**
 * The staged-edit controller for one array: at most one session at a time,
 * shared by everything that asks for this array's controller.
 *
 * @group Authoring
 */
export interface ExternalEdit<T> {
  /** The open session, if any. Reads through `rc`. */
  session(rc: ReadContext): EditSession<T> | undefined;
  /** Open a session over the element at `index`. */
  beginEdit(index: number): void;
  /** Write the draft back to the element and close the session. */
  apply(): void;
  /** Close the session, discarding the draft. */
  cancel(): void;
}

/**
 * The staged-edit controller for an array, created on first use and cached on
 * the array's control — so the collection that begins an edit and the dialog
 * that hosts it share one session without being anywhere near each other in
 * the tree. Not a hook: it may be called anywhere.
 *
 * @group Authoring
 */
export function getExternalEdit<T>(
  ctx: ControlContext,
  control: Control<T[]>,
): ExternalEdit<T> {
  return editController(ctx, control);
}

/** The session as the framework holds it: with the beginning boundary's token. */
interface InternalSession<T> extends EditSession<T> {
  origin?: unknown;
}
interface InternalEdit<T> extends ExternalEdit<T> {
  session(rc: ReadContext): InternalSession<T> | undefined;
  beginEdit(index: number, origin?: unknown): void;
}

const EDIT_KEY = "$externalEdit";

/**
 * The staged-edit controller, cached on the array control's meta so the
 * collection that begins an edit and the host that shows the draft share one
 * session wherever they sit. It watches nothing itself: the collection
 * boundary ends a session it began when it locks or hides.
 */
function editController<T>(
  ctx: ControlContext,
  control: Control<T[]>,
): InternalEdit<T> {
  const existing = peekExternalEdit(control);
  if (existing) return existing;
  const sessionControl = ctx.newControl<InternalSession<T> | undefined>(
    undefined,
  );
  const controller: InternalEdit<T> = {
    session: (rc) => rc.getValue(sessionControl),
    beginEdit: (index, origin) => {
      const element = untrackedRead.getElements(control)[index];
      const draft = ctx.newControl<T>(
        structuredClone(untrackedRead.getValue(element)),
      );
      ctx.update((wc) => wc.setValue(sessionControl, { index, draft, origin }));
    },
    apply: () => {
      const s = untrackedRead.getValue(sessionControl);
      if (!s) return;
      const element = untrackedRead.getElements(control)[s.index];
      ctx.update((wc) => {
        wc.setValue(element, untrackedRead.getValue(s.draft));
        wc.setValue(sessionControl, undefined);
      });
    },
    cancel: () => ctx.update((wc) => wc.setValue(sessionControl, undefined)),
  };
  control.meta[EDIT_KEY] = controller;
  return controller;
}

/** The controller, if one has been created for this array; never creates one. */
function peekExternalEdit<T>(control: Control<T[]>): InternalEdit<T> | undefined {
  return control.meta[EDIT_KEY] as InternalEdit<T> | undefined;
}
