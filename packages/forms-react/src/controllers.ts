import type { ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type FormProp } from "./props.js";
import {
  fieldState,
  useFormScope,
  useFieldState,
  type FieldState,
} from "./scope.js";
import type { DisplayOnlyExtra, FieldOption, OptionValue } from "./widgets.js";

/*
 * Controllers: the platform-agnostic half of a widget. An implementation calls
 * one, then only draws. Each owns the component's render boundary too — an
 * implementation is one component with one tracking window, so returning `rc`
 * and `rendered` saves every implementation the `useReactive()` ceremony and
 * removes a way to get it wrong.
 */

/**
 * What every controller returns.
 *
 * @group Implementations
 */
export interface FieldController {
  /** This component's read context. Resolve extras with `getProp(rc, …)`. */
  rc: ReadContext;
  /** Close the render pass: `return rendered(<…/>)`. */
  rendered: <T extends ReactNode>(node: T) => Rendered;
  /** The field's state against the scope its boundary published. */
  state: FieldState;
}

/**
 * A text control's state and handlers.
 *
 * @group Implementations
 */
export interface TextInputController extends FieldController {
  /** The value as text; empty for `null` and `undefined`. */
  value: string;
  /** There is a value — for a floating label. */
  filled: boolean;
  /** Write a new value. */
  setValue(value: string): void;
  /** Mark the field touched. */
  onBlur(): void;
}

/**
 * The controller for a text control.
 *
 * @group Implementations
 */
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

/**
 * A number control's state and handlers.
 *
 * @group Implementations
 */
export interface NumberInputController extends FieldController {
  /** The value, or `undefined` when empty. */
  value: number | undefined;
  /** There is a value. */
  filled: boolean;
  /** Write a new value; `undefined` empties it. */
  setValue(value: number | undefined): void;
  /** Mark the field touched. */
  onBlur(): void;
}

/**
 * The controller for a number control.
 *
 * @group Implementations
 */
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

/**
 * A checkbox's state and handlers.
 *
 * @group Implementations
 */
export interface CheckboxController extends FieldController {
  /** Checked; `false` for `null` and `undefined`. */
  checked: boolean;
  /** Write a new value. */
  setChecked(checked: boolean): void;
  /** Mark the field touched. */
  onBlur(): void;
}

/**
 * The controller for a checkbox.
 *
 * @group Implementations
 */
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

/**
 * An options control's state and handlers.
 *
 * @group Implementations
 */
export interface SelectController extends FieldController {
  /** The value as the platform sees it — always a string; empty for none. */
  stringValue: string;
  /** The choices, resolved. */
  options: FieldOption[];
  /**
   * Write the option a string names, as the option's own value — so a numeric
   * option stays numeric. The empty string clears the value.
   */
  setFromString(value: string): void;
  /** Write a value directly. */
  setValue(value: OptionValue): void;
  /** Mark the field touched. */
  onBlur(): void;
}

/**
 * The controller for an options control — select or radio.
 *
 * @group Implementations
 */
export function useSelectController(
  field: Control<OptionValue>,
  options?: FormProp<FieldOption[]>,
): SelectController {
  const { rc, rendered, update } = useReactive();
  // Resolved here, in the implementation's window: the boundary hands a
  // widget's own props through unresolved.
  const list = getProp(rc, options) ?? [];
  const value = rc.getValue(field);
  const setValue = (v: OptionValue) => update((wc) => wc.setValue(field, v));
  return {
    rc,
    rendered,
    state: useFieldState(rc, field),
    options: list,
    stringValue: value === undefined || value === null ? "" : String(value),
    setValue,
    // Round-trip through the option list rather than `Number(s)`: that is
    // what keeps a numeric option numeric without guessing.
    setFromString: (s) =>
      setValue(
        s === "" ? undefined : (list.find((o) => String(o.value) === s)?.value ?? s),
      ),
    onBlur: () => update((wc) => wc.setTouched(field, true, true)),
  };
}

/**
 * A read-only value's text and empty state.
 *
 * @group Implementations
 */
export interface DisplayValueController extends FieldController {
  /** The value as text, or `undefined` when empty. */
  text: string | undefined;
  /** The value is empty. */
  empty: boolean;
  /** What to show: the text; else `sampleText` in design mode; else `emptyText`. */
  content: ReactNode;
}

/**
 * The controller for a read-only value: value to text through the options and
 * `format`, and the empty-state choice.
 *
 * @group Implementations
 */
export function useDisplayValue(
  field: Control<unknown>,
  extra: DisplayOnlyExtra,
): DisplayValueController {
  const { rc, rendered } = useReactive();
  const scope = useFormScope();
  const value = rc.getValue(field);
  const list = getProp(rc, extra.options) ?? [];
  const format = extra.format ?? String;
  const one = (v: unknown) =>
    list.find((o) => o.value === v)?.name ?? format(v);
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
    // The one place design mode enters a widget's data path: a designer's
    // stand-in for a value that is not there.
    content: text ?? (scope.designMode && sample != null ? sample : emptyText),
  };
}
