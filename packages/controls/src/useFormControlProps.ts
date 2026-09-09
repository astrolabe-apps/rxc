"use client";

import type { ChangeEvent } from "react";
import type { Control } from "@rxc/controls-core";
import { useFormEdit } from "./FormEditState.js";
import { useControlContext } from "./useReactive.js";
import type { ReadContext } from "@rxc/controls-core";

/**
 * The props binding a control to a native form element. Every member is a
 * real DOM prop, so the whole object spreads onto an
 * `<input>`/`<select>`/`<textarea>` (or a component that accepts them) with
 * nothing to pick off first.
 */
export interface FormControlProps<V, E extends HTMLElement> {
  value: V;
  onChange: (e: ChangeEvent<E & { value: any }>) => void;
  onBlur: () => void;
  disabled: boolean;
  readOnly?: boolean;
  ref: (elem: HTMLElement | null) => void;
}

/**
 * What {@link useFormControlProps} returns: the DOM props, and the error
 * message alongside them rather than mixed in.
 *
 * `errorText` was previously a member of `props`, which meant every caller
 * had to destructure it out before spreading — and a caller that forgot put
 * an unknown attribute on a DOM element. Keeping it out here makes the
 * spread safe by construction.
 */
export interface FormControlBinding<V, E extends HTMLElement> {
  props: FormControlProps<V, E>;
  /** The error message, once the control has been touched. */
  errorText?: string | null;
}

/**
 * Bind a control to a native form element.
 *
 * Reads go through `rc` — pass your component's own, since your render pass
 * is what should re-run on value/disabled/touched/valid changes. Writes batch
 * through the ambient `ControlContext`, and the `ref` stores the DOM element
 * on `control.meta.element` (for focus-on-error, `setCustomValidity`, etc.).
 *
 * The cascading {@link FormEditState} is folded in restriction-only: it can
 * add `disabled`/`readOnly`, never re-enable a control that is disabled in
 * its own right. This fold is the single place that merge happens — the
 * `ControlInput`/`ControlSelect`/`ControlCheckbox` components all consume it from here.
 */
export function useFormControlProps<V, E extends HTMLElement>(
  rc: ReadContext,
  control: Control<V>,
): FormControlBinding<V, E> {
  const ctx = useControlContext();
  const edit = useFormEdit();
  const error = rc.getError(control);
  const valid = rc.isValid(control);
  return {
    props: {
      ref: (elem) => {
        control.meta.element = elem;
      },
      value: rc.getValue(control),
      disabled: rc.isDisabled(control) || !!edit.disabled,
      readOnly: !!edit.readOnly,
      onBlur: () => ctx.update((wc) => wc.setTouched(control, true)),
      onChange: (e) => ctx.update((wc) => wc.setValue(control, e.target.value)),
    },
    errorText: rc.isTouched(control) && !valid ? error : undefined,
  };
}
