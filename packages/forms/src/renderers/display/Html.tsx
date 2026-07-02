"use client";

import { controls } from "@rxc/controls";
import {
  isDisplayControl,
  type HtmlDisplay,
} from "@rxc/forms-core";
import { clsx, rendererClass, type DisplayRendererProps } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Renders raw HTML. **Caller is responsible for sanitization** — Display
 * data flows through the renderer untouched. Use only with trusted
 * authoring sources.
 *
 * Wrapped in `controls()` and reads `displayData.html` from
 * `node.getState(rc).definition` rather than the passed-in `data` prop —
 * `data` is a scripted-proxy bound to the dispatching `<Field>`'s rc,
 * whose reconcile has already happened by the time this renderer's body
 * runs, so reads through it land in nobody's subscription. Reading via
 * the renderer's own `rc` puts the dependency on this component's own
 * tracker, so async `Display` script overrides on `displayData.html`
 * re-render this component when they land.
 */
export const HtmlDisplayRenderer = controls<DisplayRendererProps>(
  "HtmlDisplayRenderer",
  ({ node }, { rc }) => {
    const displayTheme = useHtmlTheme().display ?? {};
    const def = node.getState(rc).definition;
    const html = isDisplayControl(def)
      ? (def.displayData as HtmlDisplay).html ?? ""
      : "";
    // textClass goes on the rendered element to match legacy parity —
    // the HtmlDisplay renderer's only element is the wrapper, so any
    // text styling on the control belongs on it. styleClass layers on
    // top for per-control wrapper styling.
    const textClassName = rendererClass(def.textClass, displayTheme.htmlClass);
    const styleClassName = rendererClass(def.styleClass, undefined);
    const className = clsx(styleClassName, textClassName);
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);
