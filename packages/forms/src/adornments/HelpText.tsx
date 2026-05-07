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
}: AdornmentRenderProps<HelpTextAdornmentDef>) {
  const helpTheme = useHtmlTheme().adornment?.helpText ?? {};
  const help = (
    <p className={helpTheme.contentTextClass ?? DEFAULT_TEXT}>
      {adornment.helpText}
    </p>
  );
  const inlineClass = helpTheme.contentClass ?? DEFAULT_INLINE;
  switch (adornment.placement) {
    case AdornmentPlacement.ControlStart:
      return (
        <span className={inlineClass}>
          {help}
          {children}
        </span>
      );
    case AdornmentPlacement.ControlEnd:
      return (
        <span className={inlineClass}>
          {children}
          {help}
        </span>
      );
    default:
      return (
        <div className={DEFAULT_BLOCK}>
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
