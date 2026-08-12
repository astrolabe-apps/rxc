import { toImpl } from "./controlImpl";
import type { ControlImpl } from "./controlImpl";
import type { WriteContextImpl } from "./writeContextImpl";
import { ControlChange } from "./types";
import type {
  Control,
  ControlContext,
  ControlValue,
  WriteContext,
} from "./types";

/**
 * Create a group control from existing controls.
 *
 * The children are **attached**, not copied: each becomes the group's field
 * for its key while keeping any parents it already has, and value changes
 * flow both ways — writing the group writes the children, a child change
 * updates the group's value, and validity/dirty aggregate from the children
 * as for any parent control.
 *
 * This is how an ad-hoc form is assembled from independently owned controls
 * (and how `useSelectableArray` builds its `{selected, value}` entries while
 * the `value` controls stay shared with the original array).
 *
 * The group's initial value is composed from the children's initial values,
 * so its dirtiness reflects theirs.
 */
export function controlGroup<C extends { [k: string]: Control<any> }>(
  ctx: ControlContext,
  fields: C,
): Control<{ [K in keyof C]: ControlValue<C[K]> }> {
  const value: Record<string, unknown> = {};
  const initial: Record<string, unknown> = {};
  for (const [k, c] of Object.entries(fields)) {
    value[k] = c.valueNow;
    initial[k] = c.initialValueNow;
  }
  const parent = toImpl(ctx.newControl<unknown>(value));
  // Not yet observable — no subscribers, no parents — so the initial value
  // and field links can be set directly without notification plumbing.
  parent._initialValue = initial;
  attachFields(parent, fields);
  return parent as unknown as Control<{ [K in keyof C]: ControlValue<C[K]> }>;
}

/**
 * Attach (or replace) fields on an existing group control, inside a write
 * batch.
 *
 * The mutating counterpart of {@link controlGroup} for a control that may
 * already have subscribers: new children are merged over the existing fields
 * (a replaced child is detached, keeping its other parents), and the group's
 * value/initial value are recomputed through the normal write path so
 * subscribers are notified.
 */
export function setFields<V, OTHER extends { [p: string]: unknown }>(
  wc: WriteContext,
  control: Control<V>,
  fields: { [K in keyof OTHER]-?: Control<OTHER[K]> },
): Control<V & OTHER> {
  const parent = toImpl(control);
  if (attachFields(parent, fields)) {
    const notify = (wc as WriteContextImpl).notify;
    const value: Record<string, unknown> = {
      ...(parent._value as Record<string, unknown> | null),
    };
    const initial: Record<string, unknown> = {
      ...(parent._initialValue as Record<string, unknown> | null),
    };
    for (const k in parent._fields) {
      value[k] = parent._fields[k]._value;
      initial[k] = parent._fields[k]._initialValue;
    }
    parent.setValueImpl(value as V, notify);
    parent.setInitialValueImpl(initial as V, notify);
    parent._subscriptions?.applyChange(ControlChange.Structure);
    notify(parent);
  }
  return control as unknown as Control<V & OTHER>;
}

/** Link `fields` into `parent._fields`; returns whether anything changed. */
function attachFields(
  parent: ControlImpl,
  fields: Record<string, Control<unknown>>,
): boolean {
  parent._fields ??= Object.create(null);
  let changed = false;
  for (const [k, c] of Object.entries(fields)) {
    const child = toImpl(c);
    const existing = parent._fields![k];
    if (existing === child) continue;
    changed = true;
    // A replaced child keeps its other parents — mirror element detach.
    existing?.updateParentLink(parent, undefined);
    parent._fields![k] = child;
    child.updateParentLink(parent, k);
  }
  return changed;
}
