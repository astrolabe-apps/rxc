import type { ComponentType, ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import type { Rendered } from "@rx-controls/react";
import type { ClassValue, FormProp } from "./props.js";
import type { RegistrySlot } from "./registry.js";
import { notBuiltComponent } from "./notBuilt.js";

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
   * Written into the field while it is shown, not pending, and its value is
   * `undefined` (`null` counts as a value). With `clearHidden` the two form a
   * cycle — hide, cleared, show, defaulted again — so a section that reappears
   * comes back in its initial state. Never applied by a boundary that does not
   * write, such as {@link DisplayOnlyField}.
   */
  defaultValue?: FormProp<T>;
  /** The label. */
  label?: FormProp<ReactNode>;
  /** Reject an empty value. A flag, never baked into `label`: the implementation draws the marker. */
  required?: FormProp<boolean>;
  /** The message for an empty required value. */
  requiredMessage?: FormProp<string>;
  /**
   * Validators for this field's value. A record keys each one, so each
   * publishes and clears independently; a bare function is keyed `default`.
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
export interface FieldBoundaryOptions {
  /**
   * `false` for a widget that only shows its value. The boundary then never
   * writes the data it binds — no `clearHidden`, no `defaultValue` — whatever
   * the form says. A property of the boundary, so no caller can forget it.
   */
  writes?: boolean;
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
  options?: FieldBoundaryOptions,
): (props: FieldProps<T> & P) => Rendered {
  return notBuiltComponent("fieldRenderer");
}
