"use client";

import { useId, useState } from "react";
import {
  ControlAdornmentType,
  IconLibrary,
  type AccordionAdornment as AccordionAdornmentDef,
  type IconReference,
} from "@rxc/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";
import { clsx } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../useHtmlTheme";
import { resolveIcon } from "../renderers/display/Icon";

const DEFAULT_BUTTON = "flex items-center gap-2 my-2 w-fit";
const DEFAULT_TITLE = "cursor-pointer";
const DEFAULT_ICON_OPEN: IconReference = {
  library: IconLibrary.FontAwesome,
  name: "chevron-up",
};
const DEFAULT_ICON_CLOSED: IconReference = {
  library: IconLibrary.FontAwesome,
  name: "chevron-down",
};

function AccordionAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<AccordionAdornmentDef>) {
  const accTheme = useHtmlTheme().adornment?.accordion ?? {};
  // Initial expansion comes from the schema; once toggled we track local
  // state. Phase 3 keeps this purely component-local — persisting across
  // unmount/remount via `data.meta` is a Phase 4b polish.
  const [open, setOpen] = useState(adornment.defaultExpanded ?? false);
  const panelId = useId();
  const iconRef = open
    ? accTheme.iconOpen ?? DEFAULT_ICON_OPEN
    : accTheme.iconClosed ?? DEFAULT_ICON_CLOSED;
  const resolved = resolveIcon(undefined, iconRef);
  const iconClass = clsx(resolved.className, accTheme.togglerClass);
  return (
    <div className={accTheme.wrapperClass}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={accTheme.className ?? DEFAULT_BUTTON}
      >
        <span className={accTheme.titleClass ?? DEFAULT_TITLE}>
          {adornment.title}
        </span>
        {iconClass || resolved.text ? (
          <i className={iconClass} aria-hidden>
            {resolved.text}
          </i>
        ) : null}
      </button>
      {open ? (
        <div id={panelId} role="region" className={accTheme.contentClass}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const AccordionAdornment: AdornmentRegistration<AccordionAdornmentDef> =
  {
    type: ControlAdornmentType.Accordion,
    kind: "field",
    priority: 1000,
    render: AccordionAdornmentRender,
  };
