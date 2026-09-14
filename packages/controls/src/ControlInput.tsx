"use client";

import React from "react";
import type { Control } from "@rx-controls/core";
import { useReactive } from "./useReactive.js";
import { useControlEffect } from "./useControlEffect.js";
import { useFormControlProps } from "./useFormControlProps.js";
import type { Rendered } from "./types.js";

// Only allow strings and numbers
export type ControlInputProps<V extends string | number> =
  React.InputHTMLAttributes<HTMLInputElement> & {
    control: Control<V>;
  };

/**
 * An `<input>` bound to a control.
 *
 * Self-subscribing — it opens its own render boundary, so typing re-renders
 * this component alone, never the parent. Honours the ambient
 * {@link FormEditState} (restriction-only), publishes the control's error as
 * HTML5 custom validity, and stores the element on `control.meta.element`.
 */
export function ControlInput<V extends string | number>({
  control,
  ...props
}: ControlInputProps<V>): Rendered {
  const { rc, rendered } = useReactive();
  // Update the HTML5 custom validity whenever the error message changes.
  useControlEffect(
    (rc) => rc.getError(control),
    (s) =>
      (control.meta.element as HTMLInputElement | null)?.setCustomValidity(
        s ?? "",
      ),
  );
  // `ref` is pulled out and discarded — this component sets its own below,
  // to attach custom validity as well as the element.
  const {
    props: { value, ref, ...inputProps },
  } = useFormControlProps<V, HTMLInputElement>(rc, control);
  return rendered(
    <input
      {...inputProps}
      value={value == null ? "" : value}
      ref={(r) => {
        control.meta.element = r;
        if (r) r.setCustomValidity(control.errorNow ?? "");
      }}
      {...props}
    />,
  );
}
