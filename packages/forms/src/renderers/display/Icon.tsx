"use client";

import {
  IconLibrary,
  type IconDisplay,
  type IconReference,
} from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
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
    switch (icon.library) {
      case IconLibrary.FontAwesome:
        return { className: `fa fa-${icon.name}` };
      case IconLibrary.Material:
        // Google Material Symbols / Icons use ligatures — wrapper class
        // plus the icon name as text content.
        return {
          className: "material-symbols-outlined",
          text: icon.name,
        };
      case IconLibrary.CssClass:
        return { className: icon.name };
      default:
        return { className: icon.name };
    }
  }
  return { className: iconClass ?? "" };
}

/** @deprecated Use `resolveIcon` — Material library needs text content. */
export function iconClassFor(
  iconClass: string | null | undefined,
  icon: IconReference | null | undefined,
): string {
  return resolveIcon(iconClass, icon).className;
}

export function IconDisplayRenderer({ data }: DisplayRendererProps) {
  const displayTheme = useHtmlTheme().display ?? {};
  const d = data as IconDisplay;
  const resolved = resolveIcon(d.iconClass, d.icon);
  const finalClass = rendererClass(resolved.className, displayTheme.iconClass);
  if (!finalClass && !resolved.text) return null;
  return (
    <i className={finalClass} aria-hidden>
      {resolved.text}
    </i>
  );
}
