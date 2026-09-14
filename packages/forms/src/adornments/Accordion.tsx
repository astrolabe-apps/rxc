"use client";

import { useId, useState } from "react";
import {
  ControlAdornmentType,
  IconLibrary,
  type AccordionAdornment as AccordionAdornmentDef,
  type IconReference,
} from "@rx-controls/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rx-controls/forms-react-core";
import { clsx } from "@rx-controls/forms-react-core";
import { useHtmlTheme } from "../useHtmlTheme";
import { resolveIcon } from "../renderers/display/Icon";


function AccordionAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<AccordionAdornmentDef>) {
  const accTheme = useHtmlTheme().adornment.accordion;
  // Initial expansion comes from the schema; once toggled we track local
  // state. Phase 3 keeps this purely component-local — persisting across
  // unmount/remount via `data.meta` is a Phase 4b polish.
  const [open, setOpen] = useState(adornment.defaultExpanded ?? false);
  const panelId = useId();
  const iconRef = open
    ? accTheme.iconOpen
    : accTheme.iconClosed;
  const resolved = resolveIcon(undefined, iconRef);
  const iconClass = clsx(resolved.className, accTheme.togglerClass);
  return (
    <div className={accTheme.wrapperClass}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={accTheme.className}
      >
        <span className={accTheme.titleClass}>
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
