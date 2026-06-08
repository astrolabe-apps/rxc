"use client";

import { controls } from "@rxc/controls";
import type { Control } from "@rxc/controls-core";
import { dataRef } from "@rxc/forms-core";
import {
  Action,
  dataPlugin,
  type DataRendererProps,
  type FormRegistry,
  rendererClass,
} from "@rxc/forms-react-core";
import type { SearchOptions } from "@astroapps/searchstate";

/** `renderOptions.type` discriminator for the Pager renderer. */
export const PagerRenderType = "Pager";

export interface PagerClasses {
  className?: string;
  numberClass?: string;
  currentClass?: string;
  buttonGroupClass?: string;
  /** Action id dispatched for the Previous button. Hosts can register a
   *  custom renderer via `matchActionId(prevActionId, MyRenderer)`. */
  prevActionId?: string;
  /** Action id dispatched for the Next button. */
  nextActionId?: string;
  /** Button label for Previous. */
  prevText?: string;
  /** Button label for Next. */
  nextText?: string;
}

export const defaultPagerClasses: PagerClasses = {
  className: "mt-2 flex flex-col items-end",
  currentClass: "text-surface-700 dark:text-surface-400 text-sm",
  buttonGroupClass: "xs:mt-0 mt-2 inline-flex gap-2",
  numberClass: "text-surface-900 font-semibold dark:text-white",
  prevActionId: "pagerPrev",
  nextActionId: "pagerNext",
  prevText: "Previous",
  nextText: "Next",
};

export interface PagerOptions {
  /**
   * Field reference (relative to the pager's parent data context) of the
   * total result count. Defaults to `"results/total"`.
   */
  totalField?: string;
  /** Page size used when the bound `length` is unset. */
  initialPerPage?: number;
}

const defaultPagerOptions: Required<PagerOptions> = {
  totalField: "results/total",
  initialPerPage: 50,
};

/**
 * Pager renderer — offset/length pagination chrome bound to a
 * `SearchOptions` control. Reads `offset`/`length` from the bound control
 * and the total count from a sibling field (default `results/total`),
 * renders "Showing page X of Y" with Previous/Next buttons that update
 * `offset`. Ported from the legacy `@astroapps/schemas-datagrid`
 * `PagerRenderer`. The prev/next buttons are dispatched through the
 * action registry via `<Action>` so hosts can swap the renderer per id
 * (`matchActionId("pagerPrev", MyPrev)`).
 */
function createPagerRenderer(
  classes?: PagerClasses,
  options?: PagerOptions,
) {
  const pagerClasses: PagerClasses = { ...defaultPagerClasses, ...classes };
  const { totalField, initialPerPage } = { ...defaultPagerOptions, ...options };
  const prevActionId = pagerClasses.prevActionId ?? "pagerPrev";
  const nextActionId = pagerClasses.nextActionId ?? "pagerNext";
  const prevText = pagerClasses.prevText ?? "Previous";
  const nextText = pagerClasses.nextText ?? "Next";

  return controls<DataRendererProps>(
    "PagerRenderer",
    ({ node }, { rc, update }) => {
      const state = node.getState(rc);
      const search = state.data as Control<SearchOptions> | undefined;
      if (!search) return null;

      const offsetControl = search.fields.offset as Control<number>;
      const lengthControl = search.fields.length as Control<number>;
      const offset = rc.getValue(offsetControl) ?? 0;
      const perPage = rc.getValue(lengthControl) ?? initialPerPage;

      const totalControl = dataRef(node.parent.cursor(rc), totalField)
        ?.control as Control<number> | undefined;
      const currentTotal =
        (totalControl ? rc.getValue(totalControl) : 0) ?? 0;
      if (!currentTotal) return null;

      const totalPages = Math.floor((currentTotal - 1) / perPage) + 1;
      const currentPage = Math.floor(offset / perPage);
      const changePage = (dir: number) =>
        update((wc) =>
          wc.setValue(offsetControl, (currentPage + dir) * perPage),
        );

      const numText = (value: number) => (
        <span className={pagerClasses.numberClass}>{value}</span>
      );

      return (
        <div className={rendererClass(state.definition.styleClass, pagerClasses.className)}>
          <span className={pagerClasses.currentClass}>
            Showing page {numText(currentPage + 1)} of {numText(totalPages)}
          </span>
          <div className={pagerClasses.buttonGroupClass}>
            <Action
              actionId={prevActionId}
              actionText={prevText}
              disabled={currentPage <= 0}
              onClick={() => changePage(-1)}
            />
            <Action
              actionId={nextActionId}
              actionText={nextText}
              disabled={currentPage >= totalPages - 1}
              onClick={() => changePage(1)}
            />
          </div>
        </div>
      );
    },
  );
}

/**
 * Registry fragment adding the Pager renderer. The Pager binds to a
 * compound `SearchOptions` field but renders no children, so child
 * resolution is suppressed.
 */
export function pagerPlugin(
  classes?: PagerClasses,
  options?: PagerOptions,
): Partial<FormRegistry> {
  return dataPlugin({
    type: PagerRenderType,
    component: createPagerRenderer(classes, options),
    resolveChildren: () => [],
  });
}
