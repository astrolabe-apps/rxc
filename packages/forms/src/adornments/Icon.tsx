"use client";

import {
  AdornmentPlacement,
  ControlAdornmentType,
  type IconAdornment as IconAdornmentDef,
} from "@rx-controls/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rx-controls/forms-react-core";
import { resolveIcon } from "../renderers/display/Icon";

function IconAdornmentRender({
  adornment,
  children,
  kind,
}: AdornmentRenderProps<IconAdornmentDef>) {
  const resolved = resolveIcon(adornment.iconClass, adornment.icon);
  const icon =
    resolved.className || resolved.text ? (
      <i className={resolved.className} aria-hidden>
        {resolved.text}
      </i>
    ) : null;
  const placement = adornment.placement;

  if (kind === "label") {
    if (placement === AdornmentPlacement.LabelStart) {
      return (
        <span className="inline-flex items-center gap-1">
          {icon}
          {children}
        </span>
      );
    }
    if (placement === AdornmentPlacement.LabelEnd) {
      return (
        <span className="inline-flex items-center gap-1">
          {children}
          {icon}
        </span>
      );
    }
    return <>{children}</>;
  }

  // kind === "control"
  if (placement === AdornmentPlacement.ControlEnd) {
    return (
      <span className="inline-flex items-center gap-1">
        {children}
        {icon}
      </span>
    );
  }
  if (
    placement === AdornmentPlacement.LabelStart ||
    placement === AdornmentPlacement.LabelEnd
  ) {
    return <>{children}</>;
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
  kind: ["label", "control"],
  priority: 0,
  render: IconAdornmentRender,
};
