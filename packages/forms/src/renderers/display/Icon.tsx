"use client";

import {
  IconLibrary,
  type IconDisplay,
  type IconReference,
} from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export function iconClassFor(
  iconClass: string | null | undefined,
  icon: IconReference | null | undefined,
): string {
  if (icon) {
    switch (icon.library) {
      case IconLibrary.FontAwesome:
        return `fa fa-${icon.name}`;
      case IconLibrary.Material:
      case IconLibrary.CssClass:
        return icon.name;
      default:
        return icon.name;
    }
  }
  return iconClass ?? "";
}

export function IconDisplayRenderer({ data }: DisplayRendererProps) {
  const displayTheme = useHtmlTheme().display ?? {};
  const d = data as IconDisplay;
  const cls = iconClassFor(d.iconClass, d.icon);
  const finalClass = rendererClass(cls, displayTheme.iconClass);
  if (!finalClass) return null;
  return <i className={finalClass} aria-hidden />;
}
