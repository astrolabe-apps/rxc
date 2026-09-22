import { getProp } from "./prop.js";
import type { FormProp } from "./types.js";
import type { ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import { fieldState, useFieldState, useFormScope } from "./scope.js";
import type {
  DisplayOnlyExtra,
  FieldOption,
  FieldState,
  OptionValue,
} from "./types.js";

/**
 * Platform-agnostic controller. It owns the render boundary too
 * (README finding 7): an implementation is one component with one tracking
 * window, so handing back `rc` / `rendered` saves every implementation the
 * `useReactive()` ceremony and removes a way to get it wrong.
 *
 * `state` comes from `useFieldState`: the control plus the scope the boundary
 * published around this implementation.
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
  field: Control<string | undefined | null>,
): TextInputController {
  const { rc, rendered, update } = useReactive();
  const value = rc.getValue(field) ?? "";
  return {
    rc,
    rendered,
    state: useFieldState(rc, field),
    value,
    filled: value !== "",
    setValue: (v) => update((wc) => wc.setValue(field, v)),
    onBlur: () => update((wc) => wc.setTouched(field, true, true)),
  };
}

export interface NumberInputController extends FieldController {
  value: number | undefined;
  filled: boolean;
  setValue(v: number | undefined): void;
  onBlur(): void;
}

export function useNumberInput(
  field: Control<number | undefined | null>,
): NumberInputController {
  const { rc, rendered, update } = useReactive();
  const value = rc.getValue(field) ?? undefined;
  return {
    rc,
    rendered,
    state: useFieldState(rc, field),
    value,
    filled: value !== undefined,
    setValue: (v) => update((wc) => wc.setValue(field, v)),
    onBlur: () => update((wc) => wc.setTouched(field, true, true)),
  };
}

export interface CheckboxController extends FieldController {
  checked: boolean;
  setChecked(v: boolean): void;
  onBlur(): void;
}

export function useCheckbox(
  field: Control<boolean | undefined | null>,
): CheckboxController {
  const { rc, rendered, update } = useReactive();
  return {
    rc,
    rendered,
    state: useFieldState(rc, field),
    checked: rc.getValue(field) ?? false,
    setChecked: (v) => update((wc) => wc.setValue(field, v)),
    onBlur: () => update((wc) => wc.setTouched(field, true, true)),
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
  field: Control<OptionValue>,
  optionsProp?: FormProp<FieldOption[]>,
): SelectController {
  const { rc, rendered, update } = useReactive();
  // Resolved here, in the implementation's window — the boundary hands
  // renderer-specific props through untouched.
  const options = getProp(rc, optionsProp) ?? [];
  const value = rc.getValue(field);
  const setValue = (v: OptionValue) => update((wc) => wc.setValue(field, v));
  return {
    rc,
    rendered,
    state: useFieldState(rc, field),
    options,
    stringValue: value === undefined || value === null ? "" : String(value),
    setValue,
    setFromString: (s) =>
      setValue(
        s === ""
          ? undefined
          : (options.find((o) => String(o.value) === s)?.value ?? s),
      ),
    onBlur: () => update((wc) => wc.setTouched(field, true, true)),
  };
}

export interface DisplayValueController extends FieldController {
  /** The value as text, or `undefined` when empty. */
  text: string | undefined;
  empty: boolean;
  /** What to show: the text, else `sampleText` in design mode, else `emptyText`. */
  content: ReactNode;
}

/**
 * The read-only widget's controller: value → text through options and
 * `format`, and the empty-state choice, which is the only place design mode
 * enters — `sampleText` is a designer's stand-in for data that is not there.
 */
export function useDisplayValue(
  field: Control<unknown>,
  extra: DisplayOnlyExtra,
): DisplayValueController {
  const { rc, rendered } = useReactive();
  const scope = useFormScope();
  const value = rc.getValue(field);
  const options = getProp(rc, extra.options) ?? [];
  const fmt = extra.format ?? String;
  const one = (v: unknown) =>
    options.find((o) => o.value === v)?.name ?? fmt(v);
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  const text = empty
    ? undefined
    : Array.isArray(value)
      ? value.map(one).join(", ")
      : one(value);
  const sample = getProp(rc, extra.sampleText);
  const emptyText = getProp(rc, extra.emptyText);
  return {
    rc,
    rendered,
    state: fieldState(rc, field, scope),
    text,
    empty,
    content: text ?? (scope.designMode && sample != null ? sample : emptyText),
  };
}
