"use client";

import {
  AdornmentPlacement,
  ControlAdornmentType,
  type HelpTextAdornment as HelpTextAdornmentDef,
} from "@rxc/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../useHtmlTheme";

function HelpTextAdornmentRender({
  adornment,
  children,
  kind,
}: AdornmentRenderProps<HelpTextAdornmentDef>) {
  const helpTheme = useHtmlTheme().adornment?.helpText ?? {};
  const placement = adornment.placement;
  const help = (
    <span className={helpTheme.contentTextClass}>{adornment.helpText}</span>
  );
  const inlineClass = helpTheme.inlineClass;

  if (kind === "label") {
    if (placement === AdornmentPlacement.LabelStart) {
      return (
        <span className={inlineClass}>
          {help}
          {children}
        </span>
      );
    }
    if (placement === AdornmentPlacement.LabelEnd) {
      return (
        <span className={inlineClass}>
          {children}
          {help}
        </span>
      );
    }
    return <>{children}</>;
  }

  // kind === "control"
  if (placement === AdornmentPlacement.ControlStart) {
    return (
      <span className={inlineClass}>
        {help}
        {children}
      </span>
    );
  }
  if (placement === AdornmentPlacement.ControlEnd) {
    return (
      <span className={inlineClass}>
        {children}
        {help}
      </span>
    );
  }
  if (
    placement === AdornmentPlacement.LabelStart ||
    placement === AdornmentPlacement.LabelEnd
  ) {
    // Handled by the label-kind registration; pass through for control kind.
    return <>{children}</>;
  }
  // No placement set → block layout below the control.
  return (
    <div className={helpTheme.blockClass}>
      {children}
      <p className={helpTheme.contentTextClass}>{adornment.helpText}</p>
    </div>
  );
}

export const HelpTextAdornment: AdornmentRegistration<HelpTextAdornmentDef> = {
  type: ControlAdornmentType.HelpText,
  kind: ["label", "control"],
  priority: 0,
  render: HelpTextAdornmentRender,
};
