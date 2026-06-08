"use client";

import { controls } from "@rxc/controls";
import type { Control } from "@rxc/controls-core";
import { dataRef } from "@rxc/forms-core";
import {
  dataPlugin,
  type DataRendererProps,
  type FormRegistry,
  rendererClass,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "@rxc/forms";
import type { SearchOptions } from "@astroapps/searchstate";

// Mirror `ButtonAction`'s primary-button class composition so the pager's
// prev/next match the host's themed buttons (the legacy pager routed these
// through the host action renderer). Defaults match `ButtonAction`'s.
const BUTTON_LAYOUT = "inline-flex items-center justify-center gap-1.5";
const DEFAULT_BUTTON = "px-3 py-1 rounded text-sm disabled:opacity-40";
const DEFAULT_PRIMARY = "bg-blue-600 text-white";

/** `renderOptions.type` discriminator for the Pager renderer. */
export const PagerRenderType = "Pager";

export interface PagerClasses {
  className?: string;
  numberClass?: string;
  currentClass?: string;
  buttonGroupClass?: string;
  buttonClass?: string;
}

export const defaultPagerClasses: PagerClasses = {
  className: "mt-2 flex flex-col items-end",
  currentClass: "text-surface-700 dark:text-surface-400 text-sm",
  buttonGroupClass: "xs:mt-0 mt-2 inline-flex gap-2",
  numberClass: "text-surface-900 font-semibold dark:text-white",
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
 * `PagerRenderer`; the prev/next buttons are plain `<button>`s (the legacy
 * routed them through the host action renderer) styled via `PagerClasses`.
 */
function createPagerRenderer(
  classes?: PagerClasses,
  options?: PagerOptions,
) {
  const pagerClasses: PagerClasses = { ...defaultPagerClasses, ...classes };
  const { totalField, initialPerPage } = { ...defaultPagerOptions, ...options };

  return controls<DataRendererProps>(
    "PagerRenderer",
    ({ node }, { rc, update }) => {
      const state = node.getState(rc);
      const actionTheme = useHtmlTheme().action ?? {};
      const search = state.data as Control<SearchOptions> | undefined;
      if (!search) return null;

      // Primary-button class composition, matching ButtonAction.
      const btnClass =
        pagerClasses.buttonClass ??
        rendererClass(
          actionTheme.buttonLayoutClass ?? BUTTON_LAYOUT,
          rendererClass(
            actionTheme.buttonClass ?? DEFAULT_BUTTON,
            actionTheme.primaryClass ?? DEFAULT_PRIMARY,
          ),
        );
      const btnTextClass = rendererClass(
        actionTheme.textClass,
        actionTheme.primaryTextClass,
      );

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
            <button
              type="button"
              className={btnClass}
              disabled={currentPage <= 0}
              onClick={() => changePage(-1)}
            >
              <span className={btnTextClass}>Previous</span>
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={currentPage >= totalPages - 1}
              onClick={() => changePage(1)}
            >
              <span className={btnTextClass}>Next</span>
            </button>
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
