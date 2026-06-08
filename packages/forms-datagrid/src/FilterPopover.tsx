"use client";

import { useId } from "react";
import { controls } from "@rxc/controls";
import type { Control } from "@rxc/controls-core";
import type { FieldOption } from "@rxc/forms-core";
import { setFilterValue, type SearchFilters } from "@astroapps/searchstate";
import clsx from "clsx";
import { Popover } from "./Popover";

export interface FilterPopoverProps {
  /** The `filters` field of the bound `SearchOptions` control. */
  filtersControl: Control<SearchFilters | null>;
  /** The `offset` field — reset to 0 whenever a filter changes. */
  offsetControl: Control<number>;
  /** Filter key for this column (the column's field name by default). */
  colKey: string;
  /** The selectable values for this column. */
  options: FieldOption[];
  popoverClass?: string;
  clearText?: string;
  clearClass?: string;
  /** When true, the "Clear" button is suppressed. */
  disableClear?: boolean;
}

/**
 * Column-filter popover: an `fa-filter` trigger (solid when any value is
 * selected) opening a checkbox list of the column's option values. Ported
 * from the legacy `@astroapps/schemas-datagrid` `FilterPopover`, re-expressed
 * as a `controls()` component. Options are resolved by the caller (via the
 * SchemaInterface) and passed in, rather than via a `getFilterOptions` hook.
 */
export const FilterPopover = controls<FilterPopoverProps>(
  "FilterPopover",
  (
    {
      filtersControl,
      offsetControl,
      colKey,
      options,
      popoverClass,
      clearText = "Clear",
      clearClass = "",
      disableClear,
    },
    { rc, update },
  ) => {
    const baseId = useId();
    const filters = rc.getValue(filtersControl) ?? {};
    const current = (filters[colKey] as unknown[] | undefined) ?? [];
    const isAnyChecked = current.length > 0;

    const setOption = (v: unknown, checked: boolean) =>
      update((wc) => {
        wc.updateValue(filtersControl, (cur) =>
          setFilterValue(colKey, v, checked)(cur ?? undefined),
        );
        wc.setValue(offsetControl, 0);
      });

    const clear = disableClear
      ? undefined
      : () =>
          update((wc) => {
            wc.setValue(filtersControl, {} as SearchFilters);
            wc.setValue(offsetControl, 0);
          });

    return (
      <Popover
        className={popoverClass}
        content={
          <div>
            {clear && (
              <button type="button" onClick={clear} className={clearClass}>
                {clearText}
              </button>
            )}
            {options.map((o, i) => {
              const checked = current.includes(o.value);
              return (
                <label
                  key={i}
                  className="grid grid-cols-[auto_1fr] cursor-pointer gap-2 align-text-top"
                  htmlFor={baseId + i}
                >
                  <input
                    id={baseId + i}
                    className="mt-0.5"
                    type="checkbox"
                    checked={checked}
                    onChange={() => setOption(o.value, !checked)}
                  />
                  <span className="inline align-middle">{o.name}</span>
                </label>
              );
            })}
          </div>
        }
      >
        <i
          aria-hidden
          className={clsx(isAnyChecked ? "fa-solid" : "fa-light", "fa-filter")}
        />
      </Popover>
    );
  },
);
