import { useEffect, useId, useMemo, type ComponentType } from "react";
import {
  FormEditProvider,
  Reactive,
  useControlContext,
  useFormEdit,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import { untrackedRead, type ReadContext } from "@rx-controls/core";
import { getProp } from "./prop.js";
import { arrayActions, lengthValidator } from "./collections.js";
import { peekExternalEdit } from "./externalEdit.js";
import {
  fieldState,
  FormScopeProvider,
  narrowScope,
  useFormScope,
  type ScopeState,
} from "./scope.js";
import { useFieldValidation, useMirror } from "./validation.js";
import { useRenderers } from "./renderers.js";
import {
  createValidationScope,
  useValidationScope,
  ValidationScopeProvider,
} from "./validationScope.js";
import type {
  CollectionElement,
  CollectionProps,
  CollectionRenderProps,
  FieldProps,
  FieldRenderProps,
  FormProp,
  FormRenderers,
  GroupProps,
  GroupRenderProps,
  Presence,
  Validator,
} from "./types.js";

export type FieldImplSource<T, P extends object> =
  | ComponentType<FieldRenderProps<T> & P>
  | { key: keyof FormRenderers };

const contractKeys = new Set([
  "field",
  "id",
  "hidden",
  "disabled",
  "readOnly",
  "dontClearHidden",
  "label",
  "required",
  "requiredMessage",
  "validate",
  "helpText",
  "startIcon",
  "endIcon",
  "className",
  "labelClassName",
  "labelTextClassName",
  "shellClassName",
  "textClassName",
]);

/** A `hidden` prop narrows presence; only a container narrows it to `silent`. */
function hiddenToPresence(
  hidden: FormProp<boolean> | undefined,
): (rc: ReadContext) => Presence {
  return (rc) => ((getProp(rc, hidden) ?? false) ? "hidden" : "rendered");
}

/**
 * The locks, folded in one place: this boundary's own props, whatever the
 * scope inherited, and `@rx-controls/react`'s `FormEditState` — which is the
 * cascade the binding layer already honours. Restriction-only throughout.
 */
export function useBoundScope(props: {
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
}): ScopeState {
  const parent = useFormScope();
  const edit = useFormEdit();
  const { hidden, disabled, readOnly } = props;
  return useMemo(
    () =>
      narrowScope(parent, {
        presence: hiddenToPresence(hidden),
        disabled: (rc) => (getProp(rc, disabled) ?? false) || !!edit.disabled,
        readOnly: (rc) => (getProp(rc, readOnly) ?? false) || !!edit.readOnly,
      }),
    [parent, hidden, disabled, readOnly, edit.disabled, edit.readOnly],
  );
}

/**
 * The merged locks go back down as a `FormEditProvider`, so a renderer built
 * on the binding layer (`ControlInput`, `useFormControlProps`) obeys exactly
 * what a built-in does. What is published is the merged *absolute* value, so
 * the published provider replacing rather than merging does not matter.
 *
 * **Always rendered, never conditional.** Skipping it when nothing is locked
 * looks like a free optimisation and is a remount: the element at this position
 * changes the moment a lock toggles, so React throws the implementation away
 * and builds a new one — MUI's floating label replays its shrink animation, an
 * input loses focus and selection, and any renderer state goes with it. Same
 * lesson as the hidden group in §8, third time around.
 */
function republish(
  node: React.ReactNode,
  disabled: boolean,
  readOnly: boolean,
): React.ReactNode {
  return (
    <FormEditProvider disabled={disabled} readOnly={readOnly}>
      {node}
    </FormEditProvider>
  );
}

/**
 * Design chrome, also unconditional: `display: contents` costs no layout when
 * off, where a conditional wrapper would remount everything under it whenever
 * design mode toggled.
 */
function designChrome(node: React.ReactNode, on: boolean): React.ReactNode {
  return (
    <div className="ff-boundary" data-design={on ? "" : undefined}>
      {node}
    </div>
  );
}

/**
 * The wrapper every field component is. Everything the framework guarantees
 * happens here and nowhere else:
 *
 *  - resolve every `FormProp` (§1)
 *  - narrow presence from `hidden`, fold the two locks (§4, §5)
 *  - register validators, which therefore survive whatever the impl does (§3)
 *  - run `clearHidden` on its own binding — nothing can do that for it (§8)
 *  - fold the field's state from control + scope, route class slots,
 *    resolve the error
 *  - publish its scope, so `useFieldState` in the implementation — and the
 *    rows of a collection — read the locks the boundary folded
 *  - hand the output to the implementation's `visibility` slot (§9)
 */
export function fieldRenderer<T, P extends object = {}>(
  source: FieldImplSource<T, P>,
): ComponentType<FieldProps<T> & P> {
  function FieldBoundary(props: FieldProps<T> & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const autoId = useId();

    const { field, id, dontClearHidden, validate } = props;
    const scope = useBoundScope(props);
    const presenceNow = scope.presence(rc);

    const required = getProp(rc, props.required) ?? false;
    const requiredMessage =
      getProp(rc, props.requiredMessage) ?? "Please enter a value";

    const cfg = useMirror({
      active: presenceNow !== "hidden",
      required,
      requiredMessage,
    });
    useFieldValidation(field, validate, cfg);

    // Per-boundary, because the boundary that bound the data is the only thing
    // that knows what to clear — see the POC README, finding 16.
    const control = field;
    const shouldClear =
      presenceNow === "hidden" && scope.clearHidden && !dontClearHidden;
    useEffect(() => {
      if (shouldClear) ctx.update((wc) => wc.setValue(control, undefined as T));
    }, [shouldClear, control, ctx]);

    // Attach to the nearest validation scope. In the boundary, so it happens
    // whether or not the field is on screen — an inactive tab still reports.
    const vscope = useValidationScope();
    useEffect(() => vscope?.register(control), [vscope, control]);

    const state = fieldState(rc, control, scope);
    const showError = state.touched && state.errors.length > 0;

    const renderProps: FieldRenderProps<T> = {
      field,
      id: id ?? autoId,
      label: getProp(rc, props.label),
      required,
      error: showError ? state.errors[0] : undefined,
      helpText: getProp(rc, props.helpText),
      startIcon: getProp(rc, props.startIcon),
      endIcon: getProp(rc, props.endIcon),
      className: getProp(rc, props.className),
      labelClassName: getProp(rc, props.labelClassName),
      labelTextClassName: getProp(rc, props.labelTextClassName),
      shellClassName: getProp(rc, props.shellClassName),
      textClassName: getProp(rc, props.textClassName),
    };

    const extra: Record<string, unknown> = {};
    for (const k of Object.keys(props))
      if (!contractKeys.has(k))
        extra[k] = (props as Record<string, unknown>)[k];

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<unknown>)
        : source
    ) as ComponentType<Record<string, unknown>>;
    const Visibility = renderers.visibility;

    const el = republish(
      <FormScopeProvider scope={scope}>
        <Impl
          {...(renderProps as unknown as Record<string, unknown>)}
          {...extra}
        />
      </FormScopeProvider>,
      state.disabled,
      state.readOnly,
    );
    const out = (
      <Visibility visible={presenceNow === "rendered"}>{el}</Visibility>
    );
    return rendered(designChrome(out, scope.designMode));
  }
  FieldBoundary.displayName = `FieldBoundary(${
    "key" in source ? source.key : (source.displayName ?? source.name)
  })`;
  return FieldBoundary as ComponentType<FieldProps<T> & P>;
}

export type GroupImplSource =
  | ComponentType<GroupRenderProps>
  | { key: keyof FormRenderers };

/**
 * A group boundary: scope narrowing plus chrome. It never unmounts its
 * children — they each have their own binding to clear, and an unmounted
 * boundary clears nothing. See README finding 17 for what that costs.
 */
export function groupRenderer(
  source: GroupImplSource,
  opts?: { scope?: boolean },
): ComponentType<GroupProps> {
  function GroupBoundary(props: GroupProps): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const scope = useBoundScope(props);
    const presenceNow = scope.presence(rc);

    // Opt-in: only a container that gets asked "is my content invalid" pays
    // for one. It attaches to the enclosing scope, so validity bubbles.
    const parentValidation = useValidationScope();
    const validation = useMemo(
      () =>
        opts?.scope
          ? createValidationScope(ctx, parentValidation, "section")
          : undefined,
      [ctx, parentValidation],
    );

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<GroupRenderProps>)
        : source
    ) as ComponentType<GroupRenderProps>;

    // One structure, always. Rendering `{children}` bare when hidden was the
    // obvious thing and it was wrong twice over: it remounted the subtree, and
    // it left every non-boundary child — a plain <button>, a paragraph —
    // visible, because only a boundary knows how to suppress itself.
    const body = (
      <Impl
        title={getProp(rc, props.title)}
        className={getProp(rc, props.className)}
        hidden={presenceNow !== "rendered"}
        invalid={validation ? !validation.isValid(rc) : undefined}
      >
        {props.children}
      </Impl>
    );

    const scoped = validation ? (
      <ValidationScopeProvider value={validation}>
        {body}
      </ValidationScopeProvider>
    ) : (
      body
    );

    return rendered(
      <FormScopeProvider scope={scope}>
        {republish(scoped, scope.disabled(rc), scope.readOnly(rc))}
      </FormScopeProvider>,
    );
  }
  GroupBoundary.displayName = `GroupBoundary(${
    "key" in source ? source.key : (source.displayName ?? source.name)
  })`;
  return GroupBoundary;
}

const collectionContractKeys = new Set([
  ...contractKeys,
  "children",
  "empty",
  "minLength",
  "maxLength",
]);

export type CollectionImplSource<T, P extends object> =
  | ComponentType<CollectionRenderProps<T> & P>
  | { key: keyof FormRenderers };

/**
 * A collection boundary. Everything `fieldRenderer` does — validators (a
 * `Length` among them), presence, the locks, `clearHidden` on the **array
 * itself**, class slots, design chrome — plus the three things an
 * implementation must not be trusted to redo: subscribe to structure only,
 * give every element its own tracking scope, and key by the element control's
 * `uniqueId`.
 *
 * This is what `<Each>` became. As a framework component it had no binding, so
 * none of the above reached the array.
 */
export function collectionRenderer<T, P extends object = {}>(
  source: CollectionImplSource<T, P>,
): ComponentType<CollectionProps<T> & P> {
  function CollectionBoundary(props: CollectionProps<T> & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const autoId = useId();

    const {
      field,
      id,
      dontClearHidden,
      validate,
      children,
      empty,
      minLength,
      maxLength,
    } = props;
    const scope = useBoundScope(props);
    const presenceNow = scope.presence(rc);

    const required = getProp(rc, props.required) ?? false;
    const requiredMessage =
      getProp(rc, props.requiredMessage) ?? "Please add at least one";

    const validators = useMemo(() => {
      const base: Record<string, Validator<T[]>> = typeof validate ===
      "function"
        ? { default: validate }
        : { ...(validate ?? {}) };
      if (minLength !== undefined || maxLength !== undefined)
        base.length = lengthValidator<T>({ minLength, maxLength });
      return base;
    }, [validate, minLength, maxLength]);

    const cfg = useMirror({
      active: presenceNow !== "hidden",
      required,
      requiredMessage,
    });
    useFieldValidation(field, validators, cfg);

    const control = field;
    const shouldClear =
      presenceNow === "hidden" && scope.clearHidden && !dontClearHidden;
    useEffect(() => {
      if (shouldClear)
        ctx.update((wc) => wc.setValue(control, undefined as unknown as T[]));
    }, [shouldClear, control, ctx]);

    const vscope = useValidationScope();
    useEffect(() => vscope?.register(control), [vscope, control]);

    const state = fieldState(rc, control, scope);
    const showError = state.touched && state.errors.length > 0;

    // The boundary's own actions know its scope: a locked region reports
    // every `can*` false, and `edit` stamps the session with this boundary.
    const actions = arrayActions(rc, ctx, control, {
      minLength,
      maxLength,
      scope,
      origin: autoId,
    });

    // A staged edit this boundary began ends when the boundary locks or
    // hides. Judged here rather than in the controller because this render is
    // what observes the lock however it arrives — a control write re-renders
    // it through `rc`, a React prop through the parent — where a core
    // `effect` holding the scope object would miss the second kind.
    const endsEdits =
      state.disabled || state.readOnly || presenceNow === "hidden";
    useEffect(() => {
      if (!endsEdits) return;
      const edit = peekExternalEdit(control);
      if (edit && edit.session(untrackedRead)?.origin === autoId) edit.cancel();
    }, [endsEdits, control, autoId]);

    // Structure only: adding or removing re-renders the list, editing one
    // element re-renders that element's scope.
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
      field,
      id: id ?? autoId,
      label: getProp(rc, props.label),
      required,
      error: showError ? state.errors[0] : undefined,
      helpText: getProp(rc, props.helpText),
      startIcon: getProp(rc, props.startIcon),
      endIcon: getProp(rc, props.endIcon),
      className: getProp(rc, props.className),
      labelClassName: getProp(rc, props.labelClassName),
      labelTextClassName: getProp(rc, props.labelTextClassName),
      shellClassName: getProp(rc, props.shellClassName),
      textClassName: getProp(rc, props.textClassName),
      elements,
      actions,
      empty,
    };

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<unknown>)
        : source
    ) as ComponentType<Record<string, unknown>>;
    const Visibility = renderers.visibility;

    const extra: Record<string, unknown> = {};
    for (const k of Object.keys(props))
      if (!collectionContractKeys.has(k))
        extra[k] = (props as Record<string, unknown>)[k];

    const el = republish(
      <FormScopeProvider scope={scope}>
        <Impl
          {...(renderProps as unknown as Record<string, unknown>)}
          {...extra}
        />
      </FormScopeProvider>,
      state.disabled,
      state.readOnly,
    );
    const out = (
      <Visibility visible={presenceNow === "rendered"}>{el}</Visibility>
    );
    return rendered(designChrome(out, scope.designMode));
  }
  CollectionBoundary.displayName = `CollectionBoundary(${
    "key" in source ? source.key : (source.displayName ?? source.name)
  })`;
  return CollectionBoundary as ComponentType<CollectionProps<T> & P>;
}
