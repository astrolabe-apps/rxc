"use client";

import React from "react";
import type { Control } from "@rxc/controls-core";
import { useReactive } from "./useReactive.js";
import { useControlEffect } from "./useControlEffect.js";
import { useFormControlProps } from "./useFormControlProps.js";
import type { Rendered } from "./types.js";

export type ControlSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  control: Control<string | number | undefined>;
};

/**
 * A `<select>` bound to a control. See {@link ControlInput} for the shared
 * behaviour; a native select has no read-only mode, so an ambient `readonly`
 * lock folds into `disabled` instead.
 */
export function ControlSelect({
  control,
  children,
  ...others
}: ControlSelectProps): Rendered {
  const { rc, rendered } = useReactive();
  // Update the HTML5 custom validity whenever the error message changes.
  useControlEffect(
    (rc) => rc.getError(control),
    (s) =>
      (control.meta.element as HTMLSelectElement | null)?.setCustomValidity(
        s ?? "",
      ),
  );
  const { errorText, readOnly, ref, ...theseProps } = useFormControlProps<
    string | number | undefined,
    HTMLSelectElement
  >(rc, control);
  return rendered(
    <select
      {...theseProps}
      disabled={theseProps.disabled || !!readOnly}
      ref={(r) => {
        control.meta.element = r;
        if (r) r.setCustomValidity(control.errorNow ?? "");
      }}
      {...others}
    >
      {children}
    </select>,
  );
}
