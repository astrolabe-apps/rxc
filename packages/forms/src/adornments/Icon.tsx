"use client";

import {
  AdornmentPlacement,
  ControlAdornmentType,
  type IconAdornment as IconAdornmentDef,
} from "@rxc/forms-core";
import type { AdornmentRegistration, AdornmentRenderProps } from "@rxc/forms-react-core";
import { iconClassFor } from "../renderers/display/Icon";

function IconAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<IconAdornmentDef>) {
  const cls = iconClassFor(adornment.iconClass, adornment.icon);
  const icon = cls ? <i className={cls} aria-hidden /> : null;
  if (adornment.placement === AdornmentPlacement.ControlEnd) {
    return (
      <span className="inline-flex items-center gap-1">
        {children}
        {icon}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {icon}
      {children}
    </span>
  );
}

export const IconAdornment: AdornmentRegistration<IconAdornmentDef> = {
  type: ControlAdornmentType.Icon,
  kind: "control",
  priority: 0,
  render: IconAdornmentRender,
};
