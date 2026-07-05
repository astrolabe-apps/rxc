"use client";

import { useState } from "react";
import type { Control, ReadContext } from "@rxc/controls-core";
import { useControlContext } from "@rxc/controls";
import {
  FieldType,
  type FormStateNode,
  type TextfieldRenderOptions,
} from "@rxc/forms-core";

/**
 * Platform-agnostic controllers for the free-text / numeric / temporal
 * data renderers. Each returns the value string, resolved cascade flags,
 * error state, and the change/blur handlers — no DOM element choice, no
 * theme classes. The HTML renderers in `@rxc/forms` (and a future
 * `@rxc/forms-native`) wrap these with their own input element + styling.
 *
 * Contract: `(rc, node)`, writes go through `useControlContext().update`
 * (mirrors `useWizardController`). `data` is surfaced so the renderer can
 * bail (`if (!c.data) return null`) exactly as the inline versions did;
 * `styleClass` is the definition's author-set style string, composed with
 * the theme class by the platform renderer.
 */

export interface TextInputController {
  data: Control<unknown> | undefined;
  value: string;
  placeholder: string | undefined;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  onChangeText: (next: string) => void;
  onBlur: () => void;
}

/** Controller for Textfield + Multiline. Value is null-coerced to `""`;
 *  placeholder is read from `renderOptions.placeholder` (Textfield ignores
 *  it, Multiline renders it). */
export function useTextInputController(
  rc: ReadContext,
  node: FormStateNode,
): TextInputController {
  const ctx = useControlContext();
  const { data, disabled, readonly, touched, definition } = node.getState(rc);
  const raw = data ? rc.getValue(data) : null;
  const placeholder =
    ((definition as { renderOptions?: TextfieldRenderOptions }).renderOptions
      ?.placeholder ?? undefined) || undefined;
  return {
    data,
    value: raw == null ? "" : String(raw),
    placeholder,
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onChangeText: (next) =>
      ctx.update((wc) => data && wc.setValue(data, next)),
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}

export interface NumberInputController {
  data: Control<unknown> | undefined;
  value: string;
  isInt: boolean;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  /** Buffer the raw typed string (no parse). */
  onChangeText: (next: string) => void;
  /** Parse the buffer and commit on blur, then mark touched. */
  onBlur: () => void;
}

/**
 * Controller for Number. Maintains an internal string buffer while the
 * user types (so "1." doesn't clobber the stored value) and commits the
 * parsed number — or `null` for empty — on blur. Invalid input is left to
 * the field's validators, not discarded loudly. `isInt` drives the parse
 * (parseInt vs parseFloat) and is surfaced for the input's `step`.
 */
export function useNumberController(
  rc: ReadContext,
  node: FormStateNode,
): NumberInputController {
  const ctx = useControlContext();
  const [buffer, setBuffer] = useState<string | null>(null);
  const { data, field, disabled, readonly, touched, definition } =
    node.getState(rc);
  const stored = data ? rc.getValue(data) : null;
  const isInt = field?.type === FieldType.Int;
  const display = buffer ?? (stored == null ? "" : String(stored));
  return {
    data,
    value: display,
    isInt,
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onChangeText: setBuffer,
    onBlur: () => {
      const raw = buffer ?? display;
      if (data) {
        if (raw === "") {
          ctx.update((wc) => wc.setValue(data, null));
        } else {
          const parsed = isInt ? parseInt(raw, 10) : parseFloat(raw);
          if (!Number.isNaN(parsed)) {
            ctx.update((wc) => wc.setValue(data, parsed));
          }
        }
      }
      setBuffer(null);
      ctx.update((wc) => data && wc.setTouched(data, true, true));
    },
  };
}

export interface DateInputController {
  data: Control<unknown> | undefined;
  value: string;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  onChangeText: (next: string) => void;
  onBlur: () => void;
}

/**
 * Controller for Date / DateTime / Time. Like the number controller it
 * buffers the raw string while editing, but commits it verbatim (or `null`
 * for empty) — the input's `type` owns the format, so there's no parse.
 */
export function useDateController(
  rc: ReadContext,
  node: FormStateNode,
): DateInputController {
  const ctx = useControlContext();
  const [buffer, setBuffer] = useState<string | null>(null);
  const { data, disabled, readonly, touched, definition } = node.getState(rc);
  const stored = data ? rc.getValue(data) : null;
  const display = buffer ?? (stored == null ? "" : String(stored));
  return {
    data,
    value: display,
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onChangeText: setBuffer,
    onBlur: () => {
      const raw = buffer ?? display;
      if (data) ctx.update((wc) => wc.setValue(data, raw === "" ? null : raw));
      setBuffer(null);
      ctx.update((wc) => data && wc.setTouched(data, true, true));
    },
  };
}
