import type { ReactNode } from "react";
import type { ClassValue, FormProp } from "./props.js";
import type { FieldRenderProps } from "./field.js";

/**
 * {@link TextField}'s own props.
 *
 * @group Authoring
 */
export interface TextFieldExtra {
  /** Placeholder text. */
  placeholder?: FormProp<string>;
  /** A multi-line control. */
  multiline?: FormProp<boolean>;
  /** The input's type. Default `text`. */
  inputType?: FormProp<"text" | "email" | "password" | "tel">;
  /**
   * The on-screen keyboard to offer. HTML's `inputmode` and React Native's
   * `TextInput.inputMode` take the same values, so this is one vocabulary on
   * both platforms.
   */
  inputMode?: FormProp<
    "text" | "numeric" | "decimal" | "tel" | "email" | "url" | "search" | "none"
  >;
  /**
   * An autofill token — `cc-number`, `postal-code`, `off`. The WHATWG tokens,
   * which React Native's `TextInput.autoComplete` shares, so the value passes
   * through untranslated on either platform.
   */
  autoComplete?: FormProp<string>;
  /**
   * The most characters the value may hold. The control stops the user typing
   * past it — HTML's `maxlength`, React Native's `TextInput.maxLength` — and
   * the boundary registers the same limit as a rule, keyed `maxLength`, so a
   * value that arrives longer (from the data, or pasted where the platform
   * does not cap) is reported rather than silently accepted.
   */
  maxLength?: FormProp<number>;
  /**
   * Show how many characters the value holds — "12 / 300" against
   * `maxLength`, or a formatter's own words:
   * `{ format: (n, max) => n + " / " + max + " characters" }`. An object, not
   * a bare function, which a `FormProp` would take for a derivation. Part of
   * the field: the implementation draws it in the field's shell and the
   * control is described by it, so a screen-reader user hears the limit
   * before reaching it.
   */
  showCount?: FormProp<boolean | CountFormat>;
}

/**
 * {@link TextFieldExtra.showCount}'s own words for the count.
 *
 * @group Authoring
 */
export interface CountFormat {
  /** The count's text, for the value's length and the field's `maxLength`. */
  format(length: number, max?: number): ReactNode;
}

/**
 * What the `textfield` slot receives. `TextFieldExtra` arrives unresolved.
 *
 * @group Implementations
 */
export type TextFieldRenderProps = FieldRenderProps<string | undefined | null> &
  TextFieldExtra;

/**
 * What the `checkbox` slot receives. A checkbox labels itself: it takes `label`
 * but may place it after the control, through the shell's `labelPosition`.
 *
 * @group Implementations
 */
export type CheckboxRenderProps = FieldRenderProps<boolean | undefined | null>;

/**
 * One choice. `name` / `value` rather than `label` / `id`, because it is the
 * shape the JSON schema's options already have, so the loader passes them
 * through unchanged.
 *
 * @group Authoring
 */
export interface FieldOption {
  /** What the user sees. */
  name: string;
  /**
   * What is stored. The platform turns all three into strings on the way to
   * the screen; the option list is how a value comes back as its own type.
   */
  value: string | number | boolean;
  /** Shown but not choosable. */
  disabled?: boolean;
}

/**
 * The value an options widget binds to.
 *
 * @group Authoring
 */
export type OptionValue = string | number | boolean | undefined | null;

/**
 * {@link SelectField}'s own props.
 *
 * @group Authoring
 */
export interface SelectExtra {
  /**
   * The choices. A derivation re-filters them as the data moves — and the
   * value follows: when the list moves away from the value, it is cleared
   * (see `restrictToOptions`). `undefined` from a resolved prop is a list
   * still pending, which judges nothing.
   */
  options?: FormProp<FieldOption[]>;
  /**
   * Clear the value when the options **move away from it** — it was among
   * the previous list and is not among this one: the state changed, and the
   * old state's agency is no longer offered. On by default; `false` keeps it.
   *
   * Only a move clears. A value that is not among the options when they first
   * resolve — loaded before a host's effect fills the list, written by a
   * host, a choice the form used to offer — is the data's, and kept. Values
   * compare as strings, the way the control round-trips them, so `1` and
   * `"1"` are the same choice. Never while the field is hidden, locked or
   * read-only, and never in design mode. Pair it with `defaultValue` for
   * "reset to the first choice when the list moves away from the value".
   *
   * That is not "reset on every change": a value the new list still offers
   * is kept. If two states shared an agency, switching between them would
   * keep it rather than reset to the new state's first. A form that needs
   * a reset on every change of the driving value still writes it itself.
   */
  restrictToOptions?: boolean;
}

/**
 * What the `select` slot receives.
 *
 * @group Implementations
 */
export type SelectRenderProps = FieldRenderProps<OptionValue> & SelectExtra;

/**
 * {@link RadioField}'s own props: a select's, plus per-option content and
 * per-option classes.
 *
 * @group Authoring
 */
export interface RadioExtra extends SelectExtra {
  /**
   * Content for each option — a description under every choice, a detail
   * section under the chosen one. Called for **every** option, selected or
   * not. Gate it with `<Contents hidden={!selected}>`, never `selected && …`:
   * unmounting the content unmounts the fields in it, and they stop
   * validating.
   */
  children?: (option: FieldOption, selected: boolean) => ReactNode;
  /** The wrapper around each option and its content. */
  entryClassName?: FormProp<ClassValue>;
  /** Added to the chosen option's wrapper. */
  selectedClassName?: FormProp<ClassValue>;
  /** Added to every other option's wrapper. */
  notSelectedClassName?: FormProp<ClassValue>;
}

/**
 * What the `radio` slot receives.
 *
 * @group Implementations
 */
export type RadioRenderProps = FieldRenderProps<OptionValue> & RadioExtra;

/**
 * {@link DisplayOnlyField}'s own props.
 *
 * @group Authoring
 */
export interface DisplayOnlyExtra {
  /** Value to name, as for a select. Applied per element for an array. */
  options?: FormProp<FieldOption[]>;
  /** Shown when the value is empty. */
  emptyText?: FormProp<ReactNode>;
  /** Shown in design mode when the value is empty — a designer's stand-in. */
  sampleText?: FormProp<ReactNode>;
  /**
   * One value that is not an option, as text. Default `String(value)`; an
   * array is mapped and joined with `", "`.
   */
  format?: (value: unknown) => string;
  /** The text is not selectable. */
  noSelection?: boolean;
}

/**
 * What the `displayOnly` slot receives.
 *
 * @group Implementations
 */
export type DisplayOnlyRenderProps = FieldRenderProps<unknown> &
  DisplayOnlyExtra;

/**
 * One value in a {@link CheckListField}: an option's value, narrowed to what a
 * set of choices holds. Not `boolean` — a set of booleans is not a choice.
 *
 * @group Authoring
 */
export type CheckListValue = string | number;

/**
 * {@link CheckListField}'s own props.
 *
 * @group Authoring
 */
export interface CheckListExtra {
  /**
   * The choices; each one ticked is in the value. A derivation re-filters
   * them as the data moves. A value the options do not list stays in the
   * array — it is the data's — and is simply not drawn.
   */
  options?: FormProp<FieldOption[]>;
}

/**
 * What the `checkList` slot receives. `CheckListExtra` arrives unresolved.
 *
 * @group Implementations
 */
export type CheckListRenderProps = FieldRenderProps<
  CheckListValue[] | undefined | null
> &
  CheckListExtra;
