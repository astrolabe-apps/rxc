"use client";

import {
  IconLibrary,
  type IconDisplay,
  type IconReference,
} from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";

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
  const d = data as IconDisplay;
  const cls = iconClassFor(d.iconClass, d.icon);
  if (!cls) return null;
  return <i className={cls} aria-hidden />;
}
