"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { resolveIcon, useHtmlTheme } from "@rx-controls/forms";

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

/**
 * Animated alternative to `@rx-controls/forms`'s default Accordion. Same chrome
 * (button + chevron + revealed content region, theme-driven), but the
 * content reveal uses `<AnimatePresence>` for a height/opacity transition.
 */
function MotionAccordionAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<AccordionAdornmentDef>) {
  const accTheme = useHtmlTheme().adornment?.accordion ?? {};
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
        onClick={() => setOpen((o) => !o)}
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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className={accTheme.contentClass}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const MotionAccordionAdornment: AdornmentRegistration<AccordionAdornmentDef> =
  {
    type: ControlAdornmentType.Accordion,
    kind: "field",
    priority: 1000,
    render: MotionAccordionAdornmentRender,
  };
