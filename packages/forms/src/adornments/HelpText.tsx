"use client";

import {
  AdornmentPlacement,
  ControlAdornmentType,
  type HelpTextAdornment as HelpTextAdornmentDef,
} from "@rxc/forms-core";
import type { AdornmentRegistration, AdornmentRenderProps } from "@rxc/forms-react-core";

function HelpTextAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<HelpTextAdornmentDef>) {
  const help = (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">
      {adornment.helpText}
    </p>
  );
  switch (adornment.placement) {
    case AdornmentPlacement.ControlStart:
      return (
        <span className="inline-flex items-center gap-2">
          {help}
          {children}
        </span>
      );
    case AdornmentPlacement.ControlEnd:
      return (
        <span className="inline-flex items-center gap-2">
          {children}
          {help}
        </span>
      );
    default:
      // Default: helper text below the control on its own line.
      return (
        <div className="flex flex-col gap-1">
          {children}
          {help}
        </div>
      );
  }
}

export const HelpTextAdornment: AdornmentRegistration<HelpTextAdornmentDef> = {
  type: ControlAdornmentType.HelpText,
  kind: "control",
  priority: 0,
  render: HelpTextAdornmentRender,
};
