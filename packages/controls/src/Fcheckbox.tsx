"use client";

import React from "react";
import type { Control } from "@rxc/controls-core";
import { useControlContext, useControls } from "./useControls.js";
import { useControlEffect } from "./useControlEffect.js";
import { useFormControlProps } from "./useFormControlProps.js";
import type { Rendered } from "./types.js";

export type FcheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & {
  control: Control<boolean | undefined | null>;
  type?: "checkbox" | "radio";
  /** Invert the mapping: checked renders/writes `false`. */
  notValue?: boolean;
};

/**
 * A checkbox (or radio) bound to a boolean control. See {@link Finput} for
 * the shared behaviour; a native checkbox ignores `readOnly`, so an ambient
 * `readonly` lock folds into `disabled` instead.
 */
export function Fcheckbox({
  control,
  type = "checkbox",
  notValue = false,
  ...others
}: FcheckboxProps): Rendered {
  const ctx = useControlContext();
  const { rc, rendered } = useControls();
  // Update the HTML5 custom validity whenever the error message changes.
  useControlEffect(
    (rc) => rc.getError(control),
    (s) =>
      (control.meta.element as HTMLInputElement | null)?.setCustomValidity(
        s ?? "",
      ),
  );
  const { value, onChange, errorText, readOnly, ref, ...theseProps } =
    useFormControlProps<boolean | undefined | null, HTMLInputElement>(
      rc,
      control,
    );
  return rendered(
    <input
      {...theseProps}
      disabled={theseProps.disabled || !!readOnly}
      checked={!!value !== notValue}
      ref={(r) => {
        control.meta.element = r;
        if (r) r.setCustomValidity(control.errorNow ?? "");
      }}
      onChange={(e) =>
        ctx.update((wc) =>
          wc.setValue(control, e.target.checked !== notValue),
        )
      }
      type={type}
      {...others}
    />,
  );
}
