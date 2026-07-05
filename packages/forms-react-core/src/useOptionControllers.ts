"use client";

import { useMemo } from "react";
import type { Control, ReadContext } from "@rxc/controls-core";
import { useControlContext } from "@rxc/controls";
import {
  isDataControl,
  type ControlDefinition,
  type ElementSelectedRenderOptions,
  type FieldOption,
  type FormStateNode,
} from "@rxc/forms-core";
import {
  mapChildrenByOptionValue,
  stringToValue,
  valueToString,
} from "./optionCoerce";
import { useExpression } from "./useExpression";

/**
 * Platform-agnostic controllers for the options-bearing data renderers
 * (Select / Radio / Checklist / Checkbox / ElementSelected). Each returns
 * resolved options/entries, cascade flags, and handlers — never DOM
 * elements or theme classes. Author-set class strings from the definition's
 * `renderOptions` (`entryWrapperClass` etc.) are surfaced as raw strings for
 * the platform renderer to compose with its theme.
 *
 * Contract: `(rc, node)`, writes via `useControlContext().update`.
 */

/** Per-option class strings authored on the definition's renderOptions,
 *  shared by Radio + Checklist. */
function optionEntryClasses(definition: ControlDefinition): {
  entryWrapperClass: string | null | undefined;
  selectedClass: string | null | undefined;
  notSelectedClass: string | null | undefined;
} {
  const ro = (
    definition as {
      renderOptions?: {
        entryWrapperClass?: string | null;
        selectedClass?: string | null;
        notSelectedClass?: string | null;
      };
    }
  ).renderOptions;
  return {
    entryWrapperClass: ro?.entryWrapperClass ?? undefined,
    selectedClass: ro?.selectedClass ?? undefined,
    notSelectedClass: ro?.notSelectedClass ?? undefined,
  };
}

// ── Select ───────────────────────────────────────────────────────────

export interface SelectController {
  data: Control<unknown> | undefined;
  /** Stored value as a string (the select's current value). */
  value: string;
  options: FieldOption[];
  /** Options grouped by their `group`; the null key holds ungrouped ones. */
  groups: Map<string | null, FieldOption[]>;
  /** True when any option declares a `group`. */
  usesGroups: boolean;
  required: boolean;
  /** True when nothing is selected (stored value is `""`). */
  isEmpty: boolean;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  onChangeValue: (raw: string) => void;
  onBlur: () => void;
}

export function useSelectController(
  rc: ReadContext,
  node: FormStateNode,
): SelectController {
  const ctx = useControlContext();
  const { data, field, fieldOptions, disabled, readonly, touched, definition } =
    node.getState(rc);
  const value = data ? rc.getValue(data) : undefined;
  const stored = valueToString(value);
  const options = fieldOptions ?? [];
  const groups = new Map<string | null, FieldOption[]>();
  for (const opt of options) {
    const g = opt.group ?? null;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(opt);
  }
  return {
    data,
    value: stored,
    options,
    groups,
    usesGroups: Array.from(groups.keys()).some((k) => k != null),
    required: !!field?.required,
    isEmpty: stored === "",
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onChangeValue: (raw) =>
      ctx.update(
        (wc) => data && wc.setValue(data, stringToValue(raw, field?.type)),
      ),
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}

// ── Radio ────────────────────────────────────────────────────────────

export interface RadioOptionEntry {
  option: FieldOption;
  /** Option value as its wire string (radio `value` + `onSelect` arg). */
  valueString: string;
  selected: boolean;
  /** Per-option child spawned by `defaultResolveChildren`, if any. */
  child: FormStateNode | undefined;
}

export interface RadioController {
  data: Control<unknown> | undefined;
  entries: RadioOptionEntry[];
  disabled: boolean;
  readonly: boolean;
  styleClass: string | null | undefined;
  entryWrapperClass: string | null | undefined;
  selectedClass: string | null | undefined;
  notSelectedClass: string | null | undefined;
  onSelect: (valueString: string) => void;
  onBlur: () => void;
}

export function useRadioController(
  rc: ReadContext,
  node: FormStateNode,
): RadioController {
  const ctx = useControlContext();
  const { data, field, fieldOptions, disabled, readonly, definition } =
    node.getState(rc);
  const stored = valueToString(data ? rc.getValue(data) : undefined);
  const childByValue = mapChildrenByOptionValue(rc, node);
  const entries: RadioOptionEntry[] = (fieldOptions ?? []).map((option) => {
    const valueString = valueToString(option.value);
    return {
      option,
      valueString,
      selected: stored === valueString,
      child: childByValue.get(option.value),
    };
  });
  return {
    data,
    entries,
    disabled: !!disabled,
    readonly: !!readonly,
    styleClass: definition.styleClass,
    ...optionEntryClasses(definition),
    onSelect: (valueString) =>
      ctx.update(
        (wc) =>
          data && wc.setValue(data, stringToValue(valueString, field?.type)),
      ),
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}

// ── Checklist ──────────────────────────────────────────────────────────

export interface ChecklistOptionEntry {
  option: FieldOption;
  checked: boolean;
  child: FormStateNode | undefined;
}

export interface ChecklistController {
  data: Control<unknown> | undefined;
  selected: unknown[];
  entries: ChecklistOptionEntry[];
  disabled: boolean;
  readonly: boolean;
  styleClass: string | null | undefined;
  entryWrapperClass: string | null | undefined;
  selectedClass: string | null | undefined;
  notSelectedClass: string | null | undefined;
  toggle: (optionValue: unknown, checked: boolean) => void;
  onBlur: () => void;
}

export function useChecklistController(
  rc: ReadContext,
  node: FormStateNode,
): ChecklistController {
  const ctx = useControlContext();
  const { data, fieldOptions, disabled, readonly, definition } =
    node.getState(rc);
  const value = data ? rc.getValue(data) : undefined;
  const selected = Array.isArray(value) ? (value as unknown[]) : [];
  const childByValue = mapChildrenByOptionValue(rc, node);
  const entries: ChecklistOptionEntry[] = (fieldOptions ?? []).map(
    (option) => ({
      option,
      checked: selected.includes(option.value),
      child: childByValue.get(option.value),
    }),
  );
  return {
    data,
    selected,
    entries,
    disabled: !!disabled,
    readonly: !!readonly,
    styleClass: definition.styleClass,
    ...optionEntryClasses(definition),
    toggle: (optValue, checked) => {
      const next = checked
        ? selected.includes(optValue)
          ? selected
          : [...selected, optValue]
        : selected.filter((v) => v !== optValue);
      ctx.update((wc) => data && wc.setValue(data, next));
    },
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}

// ── Checkbox ────────────────────────────────────────────────────────────

export interface CheckboxController {
  data: Control<unknown> | undefined;
  checked: boolean;
  required: boolean;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  onChange: (checked: boolean) => void;
  onBlur: () => void;
}

export function useCheckboxController(
  rc: ReadContext,
  node: FormStateNode,
): CheckboxController {
  const ctx = useControlContext();
  const { data, disabled, readonly, touched, definition } = node.getState(rc);
  return {
    data,
    checked: !!(data && rc.getValue(data)),
    required: isDataControl(definition) && !!definition.required,
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onChange: (checked) =>
      ctx.update((wc) => data && wc.setValue(data, checked)),
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}

// ── ElementSelected ─────────────────────────────────────────────────────

export interface ElementSelectedController {
  data: Control<unknown> | undefined;
  checked: boolean;
  /** The value the bound `elementExpression` resolves to. */
  elementValue: unknown;
  /** True when the element value hasn't resolved yet — the input should be
   *  disabled independently of the cascade. */
  disabledByElement: boolean;
  disabled: boolean;
  readonly: boolean;
  styleClass: string | null | undefined;
  toggle: (checked: boolean) => void;
  onBlur: () => void;
}

export function useElementSelectedController(
  rc: ReadContext,
  node: FormStateNode,
): ElementSelectedController {
  const ctx = useControlContext();
  const { data, disabled, readonly, definition } = node.getState(rc);
  const elementExpression = isDataControl(definition)
    ? (definition.renderOptions as ElementSelectedRenderOptions | undefined)
        ?.elementExpression
    : undefined;
  // Stabilize identity so useExpression only re-registers when the
  // expression definition actually changes.
  const stableExpr = useMemo(
    () => elementExpression,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elementExpression?.type, JSON.stringify(elementExpression ?? null)],
  );
  const elementValue = useExpression(rc, node, stableExpr);
  const arr = data ? (rc.getValue(data) as unknown[] | undefined) : undefined;
  return {
    data,
    checked: Array.isArray(arr) ? arr.includes(elementValue) : false,
    elementValue,
    disabledByElement: elementValue === undefined,
    disabled: !!disabled,
    readonly: !!readonly,
    styleClass: definition.styleClass,
    toggle: (checked) =>
      ctx.update((wc) => {
        if (!data) return;
        const current = (rc.getValue(data) as unknown[] | undefined) ?? [];
        if (checked) {
          if (!current.includes(elementValue))
            wc.setValue(data, [...current, elementValue]);
        } else {
          wc.setValue(
            data,
            current.filter((x) => x !== elementValue),
          );
        }
      }),
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}
