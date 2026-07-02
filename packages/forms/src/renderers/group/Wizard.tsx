"use client";

import { controls } from "@rxc/controls";
import {
  rendererClass,
  useWizardController,
  type GroupRendererProps,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";


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
    const groupTheme = useHtmlTheme().group;
    const wizTheme = groupTheme.wizard;
    const theme = groupTheme.tabs; // reuse tabs palette for page content

    const wrapperClass = rendererClass(definition.styleClass, wizTheme.className);
    const activeNode = wiz.pageChildren[wiz.currentPage];

    return (
      <div className={wrapperClass}>
        {wiz.showSteps && (
          <ol role="list" className={wizTheme.stepListClass}>
            {wiz.steps.map((s) => (
              <li
                key={s.node.uniqueId}
                aria-current={s.active ? "step" : undefined}
                className={`${wizTheme.stepClass} ${
                  !s.visible
                    ? wizTheme.stepInvisibleClass
                    : s.active
                      ? wizTheme.stepActiveClass
                      : s.completed
                        ? wizTheme.stepDoneClass
                        : wizTheme.stepPendingClass
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
          <div className={wizTheme.navClass}>
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
          <div className={wizTheme.navClass}>
            <button
              type="button"
              className={wizTheme.buttonClass}
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
              className={wizTheme.buttonClass}
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
