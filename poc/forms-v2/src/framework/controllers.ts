import { getProp } from "./prop.js";
import type { FormProp } from "./types.js";
import type { ReactNode } from "react";
import type { ReadContext } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import type {
  FieldOption,
  FieldState,
  FormField,
  OptionValue,
} from "./types.js";

/**
 * Platform-agnostic controller. It owns the render boundary too
 * (README finding 7): an implementation is one component with one tracking
 * window, so handing back `rc` / `rendered` saves every implementation the
 * `useReactive()` ceremony and removes a way to get it wrong.
 */
export interface FieldController {
  rc: ReadContext;
  rendered: <T extends ReactNode>(node: T) => Rendered;
  state: FieldState;
}

export interface TextInputController extends FieldController {
  value: string;
  filled: boolean;
  setValue(v: string): void;
  onBlur(): void;
}

export function useTextInput(
  field: FormField<string | undefined | null>,
): TextInputController {
  const { rc, rendered, update } = useReactive();
  const value = rc.getValue(field.control) ?? "";
  return {
    rc,
    rendered,
    state: field.state(rc),
    value,
    filled: value !== "",
    setValue: (v) => update((wc) => wc.setValue(field.control, v)),
    onBlur: () => update((wc) => wc.setTouched(field.control, true, true)),
  };
}

export interface NumberInputController extends FieldController {
  value: number | undefined;
  filled: boolean;
  setValue(v: number | undefined): void;
  onBlur(): void;
}

export function useNumberInput(
  field: FormField<number | undefined | null>,
): NumberInputController {
  const { rc, rendered, update } = useReactive();
  const value = rc.getValue(field.control) ?? undefined;
  return {
    rc,
    rendered,
    state: field.state(rc),
    value,
    filled: value !== undefined,
    setValue: (v) => update((wc) => wc.setValue(field.control, v)),
    onBlur: () => update((wc) => wc.setTouched(field.control, true, true)),
  };
}

export interface CheckboxController extends FieldController {
  checked: boolean;
  setChecked(v: boolean): void;
  onBlur(): void;
}

export function useCheckbox(
  field: FormField<boolean | undefined | null>,
): CheckboxController {
  const { rc, rendered, update } = useReactive();
  return {
    rc,
    rendered,
    state: field.state(rc),
    checked: rc.getValue(field.control) ?? false,
    setChecked: (v) => update((wc) => wc.setValue(field.control, v)),
    onBlur: () => update((wc) => wc.setTouched(field.control, true, true)),
  };
}

export interface SelectController extends FieldController {
  /** The DOM's view: always a string, because `<select>` has no other. */
  stringValue: string;
  options: FieldOption[];
  /** Maps a string back to the option's own `string | number` value. */
  setFromString(s: string): void;
  setValue(v: OptionValue): void;
  onBlur(): void;
}

/**
 * Options carry a value type the DOM erases — `<select>` and every library
 * built on it speak strings, while `SchemaField.options` values are
 * `string | number`. Round-tripping through the option list rather than
 * `Number(s)` is what keeps a numeric option numeric without guessing.
 */
export function useSelectController(
  field: FormField<OptionValue>,
  optionsProp?: FormProp<FieldOption[]>,
): SelectController {
  const { rc, rendered, update } = useReactive();
  // Resolved here, in the implementation's window — the boundary hands
  // renderer-specific props through untouched.
  const options = getProp(rc, optionsProp) ?? [];
  const value = rc.getValue(field.control);
  const setValue = (v: OptionValue) =>
    update((wc) => wc.setValue(field.control, v));
  return {
    rc,
    rendered,
    state: field.state(rc),
    options,
    stringValue: value === undefined || value === null ? "" : String(value),
    setValue,
    setFromString: (s) =>
      setValue(
        s === ""
          ? undefined
          : (options.find((o) => String(o.value) === s)?.value ?? s),
      ),
    onBlur: () => update((wc) => wc.setTouched(field.control, true, true)),
  };
}
