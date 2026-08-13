/**
 * Legacy standalone array mutators — thin funnels into the ambient write
 * transaction (Bridge 2). Signatures match `@astroapps/controls@1.4.2`.
 */

import type { Control as CoreControl } from "@rxc/controls-core";
import { getElementIndex as coreGetElementIndex } from "@rxc/controls-core";
import { toImpl } from "@rxc/controls-core/internal";
import { runInWc } from "./transactions";
import { asLegacy } from "./patch";
import type { Control } from "./types";

export function addElement<V>(
  control: Control<V[] | undefined | null>,
  child: V,
  index?: number | Control<V> | undefined,
  insertAfter?: boolean,
): Control<V> {
  return asLegacy(
    runInWc((wc) =>
      wc.addElement(
        control as unknown as CoreControl<V[]>,
        child,
        index as number | CoreControl<V> | undefined,
        insertAfter,
      ),
    ),
  );
}

export function removeElement<V>(
  control: Control<V[] | undefined | null>,
  child: number | Control<V>,
): void {
  runInWc((wc) =>
    wc.removeElement(
      control as unknown as CoreControl<V[]>,
      child as number | CoreControl<V>,
    ),
  );
}

export function updateElements<V>(
  control: Control<V[] | null | undefined>,
  cb: (elems: Control<V>[]) => Control<V>[],
): Control<V>[] {
  return runInWc((wc) =>
    wc.updateElements(
      control as unknown as CoreControl<V[]>,
      cb as unknown as (elems: CoreControl<V>[]) => CoreControl<V>[],
    ),
  ) as unknown as Control<V>[];
}

/**
 * Create a detached element control (same context as `control`) for later
 * attachment via `updateElements` — legacy's building block for reordering
 * with insertions.
 */
export function newElement<V>(control: Control<V[]>, elem: V): Control<V> {
  const impl = toImpl(control as unknown as CoreControl<V[]>);
  return asLegacy(impl._ctx.newControl(elem));
}

export function getElementIndex<V>(
  child: Control<V>,
  parent?: Control<V[]>,
): { index: number; initialIndex: number | undefined } | undefined {
  return coreGetElementIndex(
    child as unknown as CoreControl<V>,
    parent as unknown as CoreControl<V[]> | undefined,
  );
}
