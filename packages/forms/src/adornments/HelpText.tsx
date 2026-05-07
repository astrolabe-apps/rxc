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

const DEFAULT_TEXT = "text-xs text-zinc-500 dark:text-zinc-400";
const DEFAULT_INLINE = "inline-flex items-center gap-2";
const DEFAULT_BLOCK = "flex flex-col gap-1";

function HelpTextAdornmentRender({
  adornment,
  children,
  kind,
}: AdornmentRenderProps<HelpTextAdornmentDef>) {
  const helpTheme = useHtmlTheme().adornment?.helpText ?? {};
  const placement = adornment.placement;
  const help = (
    <span className={helpTheme.contentTextClass ?? DEFAULT_TEXT}>
      {adornment.helpText}
    </span>
  );
  const inlineClass = helpTheme.contentClass ?? DEFAULT_INLINE;

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
    <div className={DEFAULT_BLOCK}>
      {children}
      <p className={helpTheme.contentTextClass ?? DEFAULT_TEXT}>
        {adornment.helpText}
      </p>
    </div>
  );
}

export const HelpTextAdornment: AdornmentRegistration<HelpTextAdornmentDef> = {
  type: ControlAdornmentType.HelpText,
  kind: ["label", "control"],
  priority: 0,
  render: HelpTextAdornmentRender,
};
