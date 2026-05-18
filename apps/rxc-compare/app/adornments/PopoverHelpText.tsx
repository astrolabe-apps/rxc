"use client";

import * as Popover from "@radix-ui/react-popover";
import parse from "html-react-parser";
import clsx from "clsx";
import {
  AdornmentPlacement,
  ControlAdornmentType,
  type HelpTextAdornment as HelpTextAdornmentDef,
} from "@rxc/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";
import type { ExtendedHelpText } from "../formExtensions";

type Extended = HelpTextAdornmentDef & Partial<ExtendedHelpText>;

function HelpTextButton({ adornment }: { adornment: Extended }) {
  const label = adornment.helpLabel;
  const help = adornment.helpText ?? "";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={clsx(
            "font-bold text-sm whitespace-nowrap",
            label && "bg-surface-100 px-1 rounded-md",
          )}
        >
          <i className="fa fa-info-circle mr-2" />
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-neutral-900 text-sm text-center font-semibold leading-none text-white min-w-56 max-w-72 rounded-md px-4 py-2 [&_a]:underline z-50"
          side="top"
        >
          <div className="body !text-[16px] !text-white">{parse(help)}</div>
          <Popover.Arrow height={7} width={15} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function PopoverHelpTextRender({
  adornment,
  children,
  kind,
}: AdornmentRenderProps<HelpTextAdornmentDef>) {
  const a = adornment as Extended;
  const placement = a.placement ?? AdornmentPlacement.LabelEnd;
  const button = <HelpTextButton adornment={a} />;
  const inlineWrap = "inline-flex items-center gap-2";

  if (kind === "label") {
    if (placement === AdornmentPlacement.LabelStart) {
      return (
        <span className={inlineWrap}>
          {button}
          {children}
        </span>
      );
    }
    if (placement === AdornmentPlacement.LabelEnd) {
      return (
        <span className={inlineWrap}>
          {children}
          {button}
        </span>
      );
    }
    return <>{children}</>;
  }

  // kind === "control"
  if (placement === AdornmentPlacement.ControlStart) {
    return (
      <span className={inlineWrap}>
        {button}
        {children}
      </span>
    );
  }
  if (placement === AdornmentPlacement.ControlEnd) {
    return (
      <span className={inlineWrap}>
        {children}
        {button}
      </span>
    );
  }
  // Label-placement adornments are handled in the "label" kind branch.
  return <>{children}</>;
}

export const PopoverHelpTextAdornment: AdornmentRegistration<HelpTextAdornmentDef> =
  {
    type: ControlAdornmentType.HelpText,
    kind: ["label", "control"],
    priority: 0,
    render: PopoverHelpTextRender,
  };
