"use client";

import { useEffect, useRef } from "react";
import { ControlChange, createControlGroup } from "@rxc/controls-core";
import type {
  Control,
  ControlContext,
  ControlOptions,
  Subscription,
} from "@rxc/controls-core";
import { useControlContext } from "./useReactive.js";

/** One entry of a selectable array: the value plus whether it is selected. */
export interface SelectionGroup<V> {
  selected: boolean;
  value: V;
}

/**
 * Produces the entry list for {@link useSelectableArray}: for each candidate,
 * `[selected, valueControl, initiallySelected?]`. A value control may be an
 * element of the original array (selected) or a fresh control for a value not
 * currently present (`ctx.newControl`); `initiallySelected` defaults to
 * `selected` and drives dirtiness of the selection flag.
 */
export type SelectionBuilder<V> = (
  original: Control<V[]>,
  ctx: ControlContext,
) => [boolean, Control<V>, boolean?][];

const defaultSelectionCreator: SelectionBuilder<unknown> = (original) =>
  original.elementsNow.map((x) => [true, x]);

/**
 * A {@link SelectionBuilder} that guarantees an entry per value of
 * `values`, in order — selected when the original array already contains a
 * matching element (per `key`), unselected (with a fresh control) otherwise.
 * Array elements matching nothing in `values` are appended, selected.
 *
 * This is the multi-select checklist shape: `values` are the options, the
 * array holds what's checked.
 */
export function selectableValues<V>(
  values: V[],
  key: (v: V) => unknown,
): SelectionBuilder<V> {
  return (original, ctx) => {
    const remaining = [...original.elementsNow];
    const fromValues: [boolean, Control<V>, boolean?][] = values.map((x) => {
      const index = remaining.findIndex((e) => key(e.valueNow) === key(x));
      const existing = index >= 0 ? remaining.splice(index, 1)[0] : undefined;
      return [Boolean(existing), existing ?? ctx.newControl(x)];
    });
    return fromValues.concat(
      remaining.map((x) => [true, x] as [boolean, Control<V>]),
    );
  };
}

/**
 * Expose an array control as a list of `{selected, value}` groups.
 *
 * Each group's `value` control is **shared** with the original array (for
 * values currently in it), so edits to a selected entry write straight
 * through. Toggling a group's `selected` control rewrites the original array
 * to exactly the selected values, in entry order.
 *
 * The sync is one-way after setup: external structural changes to the
 * original array are not reflected until the hook re-syncs — pass a new
 * `reset` value to force that (it also discards selection state).
 *
 * ```tsx
 * const selectable = useSelectableArray(
 *   tags,
 *   selectableValues(ALL_TAGS, (t) => t.id),
 * );
 * // render rc.getElements(selectable) as checkboxes
 * ```
 */
export function useSelectableArray<V>(
  control: Control<V[]>,
  groupSyncer: SelectionBuilder<V> = defaultSelectionCreator as unknown as SelectionBuilder<V>,
  setup?: ControlOptions<SelectionGroup<V>[]>,
  reset?: unknown,
): Control<SelectionGroup<V>[]> {
  const ctx = useControlContext();

  const ref = useRef<{
    key: [Control<V[]>, unknown];
    selectable: Control<SelectionGroup<V>[]>;
  } | null>(null);
  if (
    !ref.current ||
    ref.current.key[0] !== control ||
    ref.current.key[1] !== reset
  ) {
    ref.current = {
      key: [control, reset],
      selectable: ctx.newControl<SelectionGroup<V>[]>([], setup),
    };
  }
  const selectable = ref.current.selectable;

  useEffect(() => {
    const syncToOriginal = () =>
      ctx.update((wc) =>
        wc.updateElements(control, () =>
          selectable.elementsNow
            .filter((g) => g.fields.selected.valueNow)
            .map((g) => g.fields.value),
        ),
      );

    const subs: [Control<boolean>, Subscription][] = [];
    ctx.update((wc) => {
      const groups = groupSyncer(control, ctx).map(
        ([selected, value, initiallySelected]) => {
          const selectedControl = ctx.newControl(selected);
          if (
            initiallySelected !== undefined &&
            initiallySelected !== selected
          ) {
            wc.setInitialValue(selectedControl, initiallySelected);
          }
          subs.push([
            selectedControl,
            selectedControl.subscribe(syncToOriginal, ControlChange.Value),
          ]);
          return createControlGroup(ctx, { selected: selectedControl, value });
        },
      );
      wc.updateElements(selectable, () => groups);
    });
    syncToOriginal();

    return () => subs.forEach(([c, s]) => c.unsubscribe(s));
    // groupSyncer follows legacy semantics: fixed per (control, reset) sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, selectable, control]);

  return selectable;
}
