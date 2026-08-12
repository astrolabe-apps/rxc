"use client";

import React from "react";
import type { Control } from "@rxc/controls-core";
import { useControls } from "./useControls";
import { useControlEffect } from "./useControlEffect";
import { useFormControlProps } from "./useFormControlProps";
import type { Rendered } from "./types";

// Only allow strings and numbers
export type FinputProps<V extends string | number> =
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
export function Finput<V extends string | number>({
  control,
  ...props
}: FinputProps<V>): Rendered {
  const { rc, rendered } = useControls();
  // Update the HTML5 custom validity whenever the error message changes.
  useControlEffect(
    (rc) => rc.getError(control),
    (s) =>
      (control.meta.element as HTMLInputElement | null)?.setCustomValidity(
        s ?? "",
      ),
  );
  const { errorText, value, ref, ...inputProps } = useFormControlProps<
    V,
    HTMLInputElement
  >(rc, control);
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
