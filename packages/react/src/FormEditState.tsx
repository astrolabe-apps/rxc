"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/**
 * Presentation overrides that cascade to form inputs via React context,
 * independent of a control's own `disabled` flag (which is reserved for
 * business state like "auto-computed" or "not applicable").
 *
 * Inputs combine these with their control state in a **restriction-only**
 * way: the context can add a lock, never re-enable a field a control
 * disabled. `useFormControlProps` owns that fold — components consume the
 * merged result rather than re-implementing it.
 *
 * ```tsx
 * // Whole subtree shown read-only (e.g. a detail view)
 * <FormEditProvider readOnly><MyForm /></FormEditProvider>
 *
 * // Disable the form while a save is in flight
 * <FormEditProvider disabled={saving}><MyForm /></FormEditProvider>
 * ```
 */
export interface FormEditState {
  /** Render inputs read-only (value shown, not editable). */
  readOnly?: boolean;
  /** Force inputs disabled regardless of control state. */
  disabled?: boolean;
}

const FormEditContext = createContext<FormEditState>({});

/** Provide a {@link FormEditState} to descendant inputs. */
export function FormEditProvider({
  readOnly,
  disabled,
  children,
}: FormEditState & { children: ReactNode }) {
  // One value per flag pair: a fresh object every render would re-render
  // every consumer below whenever the provider's parent re-renders, straight
  // through any `memo` in between.
  const value = useMemo(() => ({ readOnly, disabled }), [readOnly, disabled]);
  return (
    <FormEditContext.Provider value={value}>
      {children}
    </FormEditContext.Provider>
  );
}

/** Read the cascading {@link FormEditState}. */
export function useFormEdit(): FormEditState {
  return useContext(FormEditContext);
}
