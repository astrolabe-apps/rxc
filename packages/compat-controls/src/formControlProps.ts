"use client";

/**
 * Legacy manual input binding. Reads go through the patched ambient getters,
 * so calling this inside a tracked render (SWC plugin /
 * `useComponentTracking`) subscribes the component — exactly the legacy
 * contract. Writes funnel through the ambient transaction.
 */

import type { ChangeEvent } from "react";
import { useFormEdit } from "@rxc/controls";
import type { Control } from "./types.js";

export interface FormControlProps<V, E extends HTMLElement> {
  value: V;
  onChange: (e: ChangeEvent<E & { value: any }>) => void;
  onBlur: () => void;
  disabled: boolean;
  readOnly?: boolean;
  errorText?: string | null;
  ref: (elem: HTMLElement | null) => void;
}

export function formControlProps<V, E extends HTMLElement>(
  state: Control<V>,
): FormControlProps<V, E> {
  const error = state.error;
  const valid = state.valid;
  return {
    ref: (elem) => {
      state.element = elem;
    },
    value: state.value,
    disabled: state.disabled,
    errorText: state.touched && !valid ? error : undefined,
    onBlur: () => (state.touched = true),
    onChange: (e) => (state.value = e.target.value),
  };
}

/**
 * Like {@link formControlProps} but folds in the cascading `FormEditState`
 * (from `useFormEdit`) restriction-only: the context can add a
 * `disabled`/`readOnly` lock, never re-enable a control disabled in its own
 * right.
 */
export function useFormControlProps<V, E extends HTMLElement>(
  state: Control<V>,
): FormControlProps<V, E> {
  const edit = useFormEdit();
  const props = formControlProps<V, E>(state);
  return {
    ...props,
    disabled: props.disabled || !!edit.disabled,
    readOnly: !!edit.readonly,
  };
}
