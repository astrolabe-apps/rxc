"use client";

/**
 * Legacy `FormEditState`, which spells the read-only flag `readonly`.
 *
 * `@rxc/controls` spells it `readOnly` — the DOM spelling, matching the prop
 * bag it feeds — so this package cannot simply re-export the trio any more.
 * Legacy consumers write `<FormEditProvider readonly>`, and that has to keep
 * working, so compat owns the legacy spelling here and maps it across. Same
 * arrangement as every other legacy name in this package; the only reason it
 * needs a wrapper rather than an import alias is that the rename is to a
 * *member*, which an alias cannot reach.
 */

import type { ReactNode } from "react";
import {
  FormEditProvider as RxcFormEditProvider,
  useFormEdit as rxcUseFormEdit,
} from "@rxc/controls";

/**
 * Presentation overrides that cascade to form inputs via React context,
 * independent of a control's own `disabled` flag.
 *
 * Inputs combine these with their control state in a restriction-only way:
 * the context can add a lock, never re-enable a field a control disabled.
 */
export interface FormEditState {
  /** Render inputs read-only (value shown, not editable). */
  readonly?: boolean;
  /** Force inputs disabled regardless of control state. */
  disabled?: boolean;
}

/** @noTrackControls */
export function FormEditProvider({
  readonly,
  disabled,
  children,
}: FormEditState & { children: ReactNode }) {
  return (
    <RxcFormEditProvider readOnly={readonly} disabled={disabled}>
      {children}
    </RxcFormEditProvider>
  );
}

export function useFormEdit(): FormEditState {
  const { readOnly, disabled } = rxcUseFormEdit();
  return { readonly: readOnly, disabled };
}
