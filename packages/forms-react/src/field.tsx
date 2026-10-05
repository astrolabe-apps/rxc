import {
  useEffect,
  useId,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import {
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import { FormScopeProvider, useBoundScope } from "./scope.js";
import {
  hiddenPending,
  useDefaultValue,
  useFieldValidation,
  useMirror,
  validatorEntries,
  useRestrictToAllowed,
  useClearHidden,
  type ClearedTo,
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
  visibilityFor,
} from "./boundaryParts.js";

/**
 * A validator's verdict: a message, or nothing when the value is valid.
 *
 * @group Authoring
 */
export type ValidatorResult = string | null | undefined;

/**
 * Checks one value. Synchronous or asynchronous.
 *
 * Reads through `rc` **before the first `await`** are the validator's
 * dependencies: when any of them changes it runs again. Reads after it are not
 * tracked. A promise publishes when it resolves, a run superseded by a newer
 * one is dropped, and the previous message stays up until the new answer
 * lands, so nothing flickers. While a promise is outstanding the field counts
 * as pending in every enclosing validation scope, which is what a wizard's Next
 * waits for. There is no debounce; a validator that is expensive to call wraps
 * itself.
 *
 * @group Authoring
 */
export type Validator<T> = (
  value: T,
  rc: ReadContext,
) => ValidatorResult | Promise<ValidatorResult>;

/**
 * What an author writes on any field. Every field built-in takes these, plus
 * its own extras.
 *
 * @group Authoring
 */
export interface FieldProps<T> {
  /** The value this field edits. Typed navigation is `control.fields.x`. */
  field: Control<T>;
  /** The element id. Generated when absent. */
  id?: string;
  /** Hide this field: it stops validating and, under `clearHidden`, its value is cleared. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock this field. Cannot unlock one a region locked. */
  disabled?: FormProp<boolean>;
  /** Make this field read-only. */
  readOnly?: FormProp<boolean>;
  /** Keep this field's value when it is hidden, whatever the form's `clearHidden` says. */
  dontClearHidden?: boolean;
  /**
   * What the field writes when it clears itself — hidden under `clearHidden`,
   * or a select whose options moved away from its value. Default `undefined`,
   * which is legacy's and what a JSON form gets; a server that wants `null`
   * or `""` for an empty answer says so here, and the value type no longer
   * has to admit `undefined` for clearing's sake. `defaultValue` refills a
   * field cleared this way, but not the same value typed by the user.
   */
  clearTo?: T;
  /**
   * Written into the field while it is shown, not pending, and its value is
   * `undefined` (`null` counts as a value). With `clearHidden` the two form a
   * cycle — hide, cleared, show, defaulted again — so a section that reappears
   * comes back in its initial state. Never applied by a boundary that does not
   * write, such as {@link DisplayOnlyField}.
   */
  defaultValue?: FormProp<T>;
  /** The label. */
  label?: FormProp<ReactNode>;
  /**
   * Reject an empty value. A flag, never baked into `label`: the
   * implementation draws the marker, and the control carries
   * `aria-required`.
   *
   * The marker is `aria-hidden`, so the field's accessible name is exactly
   * its label. In tests, find the field by role and name
   * (`getByRole("textbox", { name: "First Name" })`). A query that matches a
   * label element's raw text, such as Playwright's
   * `getByLabel(…, { exact: true })`, also sees the marker and finds nothing.
   */
  required?: FormProp<boolean>;
  /** The message for an empty required value. */
  requiredMessage?: FormProp<string>;
  /**
   * Validators for this field's value. A record keys each one, so each
   * publishes and clears independently; a bare function is keyed per
   * boundary (`default@<id>`), so it never claims the plain `default` key a
   * host's server errors usually arrive under. That key is reserved: a
   * record's `default` is the bare function by another name, under the same
   * per-boundary key.
   */
  validate?: Validator<T> | Record<string, Validator<T>>;
  /** Help shown with the field. */
  helpText?: FormProp<ReactNode>;
  /** Content at the control's leading edge, inside its frame — an icon, a unit. */
  startIcon?: FormProp<ReactNode>;
  /** Content at the control's trailing edge, inside its frame. */
  endIcon?: FormProp<ReactNode>;
  /** The control. */
  className?: FormProp<ClassValue>;
  /** The label's container. */
  labelClassName?: FormProp<ClassValue>;
  /**
   * The label's text. A separate slot from its container because on React
   * Native text styles do not cascade from a `View`; an implementation whose
   * label is one element applies both.
   */
  labelTextClassName?: FormProp<ClassValue>;
  /** The wrapper around label, control, help and error. */
  shellClassName?: FormProp<ClassValue>;
  /** The control's text. */
  textClassName?: FormProp<ClassValue>;
}

/**
 * What a field implementation receives: flat and resolved, so it spreads onto
 * a shell. The boundary has already registered validators, folded the locks
 * and decided whether an error shows.
 *
 * Props that are not part of the contract — a widget's own extras — arrive
 * **unresolved**, as the author wrote them, and the implementation resolves
 * them with `getProp` in its own window. The boundary cannot resolve them
 * for it: it cannot tell a derived value `(rc) => T` from a callback.
 *
 * @group Implementations
 */
export interface FieldRenderProps<T> {
  /** The bound control. */
  field: Control<T>;
  /** The element id, generated when the author gave none. */
  id: string;
  /** The label. */
  label?: ReactNode;
  /** Draw the required marker. */
  required: boolean;
  /**
   * The error to show now, or nothing: once the field is touched, the first
   * failure of **this field's own rules**, or an error on the data that no
   * rule wrote (a server rejection). Not a rule another boundary over the
   * same control applies — a field without `required` never shows "Please
   * enter a value" because a field elsewhere requires the same value.
   *
   * A server rejection goes away when the user edits the value because core
   * clears every error on a control when its value is written — not because
   * of anything here. A control created with `keepErrors` keeps it; until the
   * host clears it, the field shows it and `check()` refuses every submit.
   */
  error?: ReactNode;
  /** Help shown with the field. */
  helpText?: ReactNode;
  /** Content at the control's leading edge. */
  startIcon?: ReactNode;
  /** Content at the control's trailing edge. */
  endIcon?: ReactNode;
  /** Inside an inline container: draw a bare inline element, no shell. */
  inline?: boolean;
  /** The control. */
  className?: ClassValue;
  /** The label's container. */
  labelClassName?: ClassValue;
  /** The label's text. */
  labelTextClassName?: ClassValue;
  /** The wrapper around label, control, help and error. */
  shellClassName?: ClassValue;
  /** The control's text. */
  textClassName?: ClassValue;
}

/**
 * What a field boundary draws with: a component of its own, or the name of a
 * registry slot the active implementation fills.
 *
 * @group Extensions
 */
export type FieldImplSource<T, P extends object> =
  | ComponentType<FieldRenderProps<T> & P>
  | RegistrySlot;

/**
 * Properties of a field boundary rather than of any one use of it.
 *
 * @group Extensions
 */
export interface FieldBoundaryOptions<T = unknown, P = {}> {
  /**
   * `false` for a widget that only shows its value. The boundary then never
   * writes the data it binds — no `clearHidden`, no `defaultValue` — whatever
   * the form says. A property of the boundary, so no caller can forget it.
   */
  writes?: boolean;
  /**
   * Rules a widget's own props imply, registered by the boundary beside the
   * author's `validate` — so a constraint the widget enforces as it is used
   * (a `maxLength` cap) and the message that reports a value breaking it come
   * from one prop and cannot disagree. Keyed like a `validate` record; a key
   * here wins over the same key in `validate`.
   */
  rules?: (props: P) => Record<string, Validator<T>> | undefined;
  /**
   * The values a widget's own props allow — a select's options — so the
   * boundary clears the value when the list moves away from it: listed
   * before, not now. Read through `rc`, so a derived list is followed as the
   * data moves. Return `undefined` for "nothing to judge yet": no list, or
   * one pending.
   */
  allowed?: (props: P, rc: ReadContext) => ((value: T) => boolean) | undefined;
}

/**
 * Build a field component. The boundary it returns resolves every
 * {@link FormProp}, narrows presence and the locks, registers the validators
 * (so no implementation can drop one) and judges them into its validation
 * scope, runs `clearHidden` and `defaultValue` on its own binding, and hands
 * `source` a {@link FieldRenderProps}. Props
 * outside the contract pass through to `source` untouched.
 *
 * This is how a third-party widget becomes a field: it gets the label, help,
 * error, locks, validation and design mode by being built this way, not by
 * reimplementing them.
 *
 * @group Extensions
 */
export function fieldRenderer<T, P extends object = {}>(
  source: FieldImplSource<T, P>,
  options?: FieldBoundaryOptions<T, P>,
): (props: FieldProps<T> & P) => Rendered {
  const writes = options?.writes !== false;
  function FieldBoundary(props: FieldProps<T> & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const autoId = useId();
    const { field: control, dontClearHidden, validate } = props;
    const id = props.id ?? autoId;

    const scope = useBoundScope(props);
    const presence = scope.presence(rc);
    const required = getProp(rc, props.required) ?? false;
    const requiredMessage =
      getProp(rc, props.requiredMessage) ?? "Please enter a value";

    // Validates only while shown and decided: a `hidden` still pending does
    // not report yet. Registration and the verdict live here, so they happen
    // whether or not the field is on screen — an inactive tab still reports.
    const cfg = useMirror({
      active: presence !== "hidden" && !hiddenPending(rc, props.hidden),
      required,
      requiredMessage,
    });
    const vscope = useValidationScope();
    const verdict = useControl<unknown>(undefined);
    const implied = options?.rules?.(props);
    useFieldValidation(
      control,
      implied ? withRules(validate, implied, id) : validate,
      cfg,
      vscope,
      id,
      verdict,
    );
    useEffect(
      () => vscope?.register(verdict, control, cfg),
      [vscope, verdict, control, cfg],
    );

    // The boundary that bound the data is the only thing that knows what to
    // clear: each clears its own binding when it becomes hidden.
    const clear =
      writes && presence === "hidden" && scope.clearHidden && !dontClearHidden;
    const cleared: ClearedTo = useRef(undefined);
    useClearHidden(control, clear, props.clearTo, cleared);
    useDefaultValue(
      control,
      props.defaultValue,
      scope,
      writes,
      props.hidden,
      cleared,
    );
    const allowed = options?.allowed;
    useRestrictToAllowed(
      control,
      (r) => allowed?.(props, r),
      scope,
      writes && !!allowed,
      props.hidden,
      props.clearTo,
      cleared,
    );

    const state = boundaryState(rc, control as Control<unknown>, scope);
    // The field shows its verdict — its own rules and the errors no rule
    // claims — the same judgement its validation scope makes.
    const own = [...new Set(Object.values(rc.getErrors(verdict)).filter(Boolean))];

    const renderProps: FieldRenderProps<T> = {
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
    };
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const Visibility = visibilityFor(renderers, scope);
    const body = republish(
      <FormScopeProvider scope={scope}>
        <Impl {...renderProps} {...extraProps(props, fieldContractKeys)} />
      </FormScopeProvider>,
      state.disabled,
      state.readOnly,
    );
    // `silent` keeps the widget mounted; its container hides it.
    return rendered(
      designChrome(
        <Visibility visible={presence !== "hidden"}>{body}</Visibility>,
        scope.designMode,
      ),
    );
  }
  FieldBoundary.displayName = boundaryName(
    "FieldBoundary",
    source as ComponentType<never>,
  );
  return bailout(FieldBoundary);
}

/** The author's `validate` with a widget's implied rules merged over it. */
function withRules<T>(
  validate: Validator<T> | Record<string, Validator<T>> | undefined,
  rules: Record<string, Validator<T>>,
  owner: string,
): Record<string, Validator<T>> {
  return { ...validatorEntries(validate, owner), ...rules };
}
