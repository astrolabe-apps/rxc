"use client";

import { useControls, type Rendered } from "@rxc/controls";
import type { Control } from "@rxc/controls-core";
import { clsx } from "@rxc/forms-react-core";
import { findSortField, rotateSort } from "@astroapps/searchstate";

export interface SortableHeaderProps {
  /** The `sort` field of the bound `SearchOptions` control. */
  sortControl: Control<string[] | null>;
  /** The `offset` field — reset to 0 whenever the sort changes. */
  offsetControl: Control<number>;
  /** The sort key for this column (the column's field name by default). */
  sortField: string;
  /** Initial direction when rotating from unsorted (`"a"` / `"d"`). */
  defaultSort?: string;
}

/**
 * Sort toggle button for a DataGrid column header. Cycles
 * unsorted → asc → desc → unsorted via `rotateSort`, and reads the
 * current direction via `findSortField`. Ported from the legacy
 * `@astroapps/schemas-datagrid` `SortableHeader`, re-expressed as a
 * `useControls()` component so it reacts to sort-state changes through its
 * own `ReadContext`.
 */
export function SortableHeader({ sortControl, offsetControl, sortField, defaultSort }: SortableHeaderProps): Rendered {
  const { rc, rendered, update } = useControls();
  const cd = findSortField(rc.getValue(sortControl), sortField);
  return rendered(
    <button
      type="button"
      onClick={() =>
        update((wc) => {
          wc.updateValue(sortControl, (cur) =>
            rotateSort(sortField, defaultSort)(cur ?? undefined),
          );
          wc.setValue(offsetControl, 0);
        })
      }
    >
      <i
        aria-hidden
        className={clsx(
          "ml-2 h-4 w-2",
          !cd
            ? "fa-light fa-sort"
            : cd === "a"
              ? "fa-solid fa-sort-up"
              : "fa-solid fa-sort-down",
        )}
      />
    </button>
  );
}
