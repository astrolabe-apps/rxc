"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ControlAdornmentType,
  type AccordionAdornment as AccordionAdornmentDef,
} from "@rxc/forms-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";

const DEFAULT_WRAPPER = "rounded border border-zinc-200 dark:border-zinc-700";
const DEFAULT_TITLE =
  "cursor-pointer select-none text-sm font-semibold p-2 text-zinc-700 dark:text-zinc-300";
const DEFAULT_CONTENT = "px-2 pb-2";

/**
 * Animated alternative to `@rxc/forms`'s native-`<details>` Accordion.
 * Drop into the registry to override the default.
 */
function MotionAccordionAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<AccordionAdornmentDef>) {
  const [open, setOpen] = useState(adornment.defaultExpanded ?? false);
  return (
    <div className={DEFAULT_WRAPPER}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={DEFAULT_TITLE}
      >
        {adornment.title}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className={DEFAULT_CONTENT}>{children}</div>
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
