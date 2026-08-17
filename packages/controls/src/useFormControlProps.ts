"use client";

import type { ChangeEvent } from "react";
import type { Control } from "@rxc/controls-core";
import { useFormEdit } from "./FormEditState.js";
import { useControlContext } from "./useControls.js";
import type { ReadContext } from "@rxc/controls-core";

/**
 * The props binding a control to a native form element. Spread onto an
 * `<input>`/`<select>`/`<textarea>` (or pass to a component that accepts
 * them).
 */
export interface FormControlProps<V, E extends HTMLElement> {
  value: V;
  onChange: (e: ChangeEvent<E & { value: any }>) => void;
  onBlur: () => void;
  disabled: boolean;
  readOnly?: boolean;
  /** The error message, once the control has been touched. Not a DOM prop —
   * pull it off before spreading. */
  errorText?: string | null;
  ref: (elem: HTMLElement | null) => void;
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
 * `Finput`/`Fselect`/`Fcheckbox` components all consume it from here.
 */
export function useFormControlProps<V, E extends HTMLElement>(
  rc: ReadContext,
  control: Control<V>,
): FormControlProps<V, E> {
  const ctx = useControlContext();
  const edit = useFormEdit();
  const error = rc.getError(control);
  const valid = rc.isValid(control);
  return {
    ref: (elem) => {
      control.meta.element = elem;
    },
    value: rc.getValue(control),
    disabled: rc.isDisabled(control) || !!edit.disabled,
    readOnly: !!edit.readonly,
    errorText: rc.isTouched(control) && !valid ? error : undefined,
    onBlur: () => ctx.update((wc) => wc.setTouched(control, true)),
    onChange: (e) => ctx.update((wc) => wc.setValue(control, e.target.value)),
  };
}
