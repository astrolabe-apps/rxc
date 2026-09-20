import type { Control, ReadContext } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import { useMemo } from "react";
import type { FieldState, FormField, FormFields } from "./types.js";
import { combineScopes, type ScopeState } from "./scope.js";

class FieldImpl<T> implements FormField<T> {
  #fields: Record<string, FormField<unknown>> = {};
  constructor(
    readonly control: Control<T>,
    readonly scope: ScopeState | undefined,
  ) {}

  state(rc: ReadContext): FieldState {
    const scope = this.scope;
    return {
      disabled: rc.isDisabled(this.control) || (scope?.disabled(rc) ?? false),
      readOnly: scope?.readOnly(rc) ?? false,
      touched: rc.isTouched(this.control),
      dirty: rc.isDirty(this.control),
      errors: Object.values(rc.getErrors(this.control)).filter(Boolean),
    };
  }

  child(name: string): FormField<unknown> {
    const existing = this.#fields[name];
    if (existing) return existing;
    const control = (this.control as Control<Record<string, unknown>>).fields[
      name
    ] as Control<unknown>;
    return (this.#fields[name] = new FieldImpl(control, this.scope));
  }

  get $(): FormFields<T> {
    return new Proxy({} as FormFields<T>, {
      get: (_t, prop) =>
        typeof prop === "string" ? this.child(prop) : undefined,
    });
  }
}

export function createFormField<T>(
  control: Control<T>,
  scope?: ScopeState,
): FormField<T> {
  return new FieldImpl(control, scope);
}

/** One element of a collection. */
export function elementField<T>(
  parent: FormField<T[]>,
  control: Control<T>,
): FormField<T> {
  return createFormField(control, scopeOf(parent));
}

/** The scope a field was bound in, if any. */
export function scopeOf(field: FormField<unknown>): ScopeState | undefined {
  return (field as FieldImpl<unknown>).scope;
}

/**
 * Bind a field to the scope where a boundary is rendering it — **combined**
 * with whatever scope it was already carrying, never replacing it.
 *
 * Replacing is what a context-only design does implicitly, and it is wrong the
 * moment an implementation renders a bound node somewhere other than where it
 * was bound: a staged-edit draft belongs to the array's scope, but its modal
 * renders elsewhere in the tree. See README finding 19.
 */
export function bindScope<T>(
  field: FormField<T>,
  scope: ScopeState,
): FormField<T> {
  const impl = field as FieldImpl<T>;
  if (impl.scope === scope) return field;
  return new FieldImpl(
    field.control,
    impl.scope ? combineScopes(impl.scope, scope) : scope,
  );
}

/** Start a form: a root binding over an existing control. */
export function useFormField<T>(control: Control<T>): FormField<T> {
  return useMemo(() => createFormField(control), [control]);
}

/** Convenience for the demo: a root control created from a value. */
export function useFormData<T>(initial: T) {
  const ctx = useControlContext();
  const control = useMemo(() => ctx.newControl(initial), [ctx]);
  return { control, field: useFormField(control) };
}
