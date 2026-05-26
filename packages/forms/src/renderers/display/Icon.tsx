"use client";

import { controls } from "@rxc/controls";
import {
  IconLibrary,
  isDisplayControl,
  type IconDisplay,
  type IconReference,
} from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";
import { clsx, rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export interface ResolvedIcon {
  className: string;
  text?: string;
}

export function resolveIcon(
  iconClass: string | null | undefined,
  icon: IconReference | null | undefined,
): ResolvedIcon {
  if (icon) {
    if (!icon.name) return { className: "" };
    switch (icon.library) {
      case IconLibrary.FontAwesome:
        return { className: `fa fa-${icon.name}` };
      case IconLibrary.Material:
        // Google Material Symbols / Icons use ligatures — wrapper class
        // plus the icon name as text content. (Diverges from legacy,
        // which returns just `icon.name` and never rendered Material
        // correctly — the dev `/buttons` page documents this.)
        return {
          className: "material-symbols-outlined",
          text: icon.name,
        };
      case IconLibrary.CssClass:
        return { className: icon.name };
      default:
        // FA6 family classes — `library` is the style class
        // (`fa-regular` / `fa-solid` / `fa-brands` / …) and the icon
        // name gets the legacy `fa-` prefix. Matches legacy
        // `schemas-html` default branch.
        return { className: `${icon.library} fa-${icon.name}` };
    }
  }
  return { className: iconClass ?? "" };
}

// See `HtmlDisplayRenderer` for the rationale on `controls()` wrapping
// and reading through `node.getState(rc)` rather than the `data` prop.
export const IconDisplayRenderer = controls<DisplayRendererProps>(
  "IconDisplayRenderer",
  ({ node }, { rc }) => {
    const displayTheme = useHtmlTheme().display ?? {};
    const def = node.getState(rc).definition;
    const d = isDisplayControl(def)
      ? (def.displayData as IconDisplay)
      : undefined;
    const resolved = resolveIcon(d?.iconClass, d?.icon);
    // `resolved.className` carries the icon's identity (FA / Material /
    // CssClass / FA6 family) and must always be on the element. Only
    // `styleClass` and the theme's `iconClass` participate in the
    // override convention — otherwise a `@ `-prefixed styleClass would
    // drop the icon-library class along with the theme styling.
    const finalClass = clsx(
      resolved.className,
      rendererClass(def.styleClass, displayTheme.iconClass),
    );
    if (!finalClass && !resolved.text) return null;
    return (
      <i className={finalClass} aria-hidden>
        {resolved.text}
      </i>
    );
  },
);
