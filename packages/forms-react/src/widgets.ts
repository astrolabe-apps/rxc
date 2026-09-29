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
  /** The choices. A derivation re-filters them as the data moves. */
  options?: FormProp<FieldOption[]>;
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
