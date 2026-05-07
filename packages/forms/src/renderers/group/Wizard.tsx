"use client";

import { controls } from "@rxc/controls";
import {
  rendererClass,
  useWizardController,
  type GroupRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_WRAPPER = "flex flex-col gap-3";
const DEFAULT_STEPLIST = "flex items-center gap-2 text-sm";
const DEFAULT_STEP = "px-2 py-1 rounded";
const DEFAULT_STEP_ACTIVE = "bg-blue-600 text-white";
const DEFAULT_STEP_DONE = "bg-green-600 text-white";
const DEFAULT_STEP_PENDING =
  "border border-zinc-200 dark:border-zinc-700 text-zinc-500";
const DEFAULT_STEP_INVISIBLE = "hidden";
const DEFAULT_NAV = "flex items-center justify-between gap-2";
const DEFAULT_BTN =
  "px-3 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-sm disabled:opacity-40";

/**
 * Renderer for `GroupRenderType.Wizard`. Shows one page child at a time
 * with an optional step indicator and built-in prev/next nav. Children
 * with `placement: "leftNav" | "middleNav" | "rightNav"` render around
 * the page; everything else is treated as a page.
 *
 * The bulk of the state lives in {@link useWizardController}; this
 * renderer only owns the chrome.
 */
export const WizardRenderer = controls<GroupRendererProps>(
  "WizardRenderer",
  ({ node }, { rc }) => {
    const { definition } = node.getState(rc);
    const wiz = useWizardController(rc, node);
    const theme = useHtmlTheme().group?.tabs ?? {}; // reuse tabs palette by default

    const wrapperClass = rendererClass(definition.styleClass, DEFAULT_WRAPPER);
    const activeNode = wiz.pageChildren[wiz.currentPage];

    return (
      <div className={wrapperClass}>
        {wiz.showSteps && (
          <ol role="list" className={DEFAULT_STEPLIST}>
            {wiz.steps.map((s) => (
              <li
                key={s.node.uniqueId}
                aria-current={s.active ? "step" : undefined}
                className={`${DEFAULT_STEP} ${
                  !s.visible
                    ? DEFAULT_STEP_INVISIBLE
                    : s.active
                      ? DEFAULT_STEP_ACTIVE
                      : s.completed
                        ? DEFAULT_STEP_DONE
                        : DEFAULT_STEP_PENDING
                }`.trim()}
                onClick={() =>
                  wiz.manualNavigation
                    ? undefined
                    : wiz.goToPage(wiz.pageChildren.indexOf(s.node))
                }
                style={
                  wiz.manualNavigation
                    ? undefined
                    : { cursor: "pointer" }
                }
              >
                {s.title}
              </li>
            ))}
          </ol>
        )}

        {(wiz.leftNav.length > 0 ||
          wiz.middleNav.length > 0 ||
          wiz.rightNav.length > 0) && (
          <div className={DEFAULT_NAV}>
            <div className="flex gap-2">
              {wiz.leftNav.map((n) => (
                <Field key={n.uniqueId} node={n} />
              ))}
            </div>
            <div className="flex gap-2">
              {wiz.middleNav.map((n) => (
                <Field key={n.uniqueId} node={n} />
              ))}
            </div>
            <div className="flex gap-2">
              {wiz.rightNav.map((n) => (
                <Field key={n.uniqueId} node={n} />
              ))}
            </div>
          </div>
        )}

        <div className={theme.contentClass}>
          {activeNode && <Field node={activeNode} />}
        </div>

        {!wiz.manualNavigation && (
          <div className={DEFAULT_NAV}>
            <button
              type="button"
              className={DEFAULT_BTN}
              disabled={!wiz.hasPrev}
              onClick={() => wiz.prev()}
            >
              Previous
            </button>
            <span className="text-xs text-zinc-500">
              {wiz.totalVisible > 0
                ? `Step ${wiz.visibleIndex + 1} of ${wiz.totalVisible}`
                : null}
            </span>
            <button
              type="button"
              className={DEFAULT_BTN}
              disabled={!wiz.hasNext}
              onClick={() => wiz.next(true)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  },
);
