"use client";

import { useState } from "react";
import {
  ControlAdornmentType,
  type AccordionAdornment as AccordionAdornmentDef,
} from "@rxc/forms-core";
import type { AdornmentRegistration, AdornmentRenderProps } from "@rxc/forms-react-core";

function AccordionAdornmentRender({
  adornment,
  children,
}: AdornmentRenderProps<AccordionAdornmentDef>) {
  // Initial expansion comes from the schema; once toggled we track local
  // state. Phase 3 keeps this purely component-local — persisting across
  // unmount/remount via `data.meta` is a Phase 4b polish.
  const [open, setOpen] = useState(adornment.defaultExpanded ?? false);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded border border-zinc-200 dark:border-zinc-700 p-2"
    >
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        {adornment.title}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export const AccordionAdornment: AdornmentRegistration<AccordionAdornmentDef> =
  {
    type: ControlAdornmentType.Accordion,
    kind: "field",
    priority: 1000,
    render: AccordionAdornmentRender,
  };
