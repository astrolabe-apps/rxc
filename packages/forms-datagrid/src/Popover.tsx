"use client";

import * as React from "react";
import type { ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { PopoverContentProps } from "@radix-ui/react-popover";

export interface PopoverProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
  side?: PopoverContentProps["side"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClass?: string;
  asChild?: boolean;
}

/**
 * Thin Radix popover wrapper — ported verbatim from the legacy
 * `@astroapps/schemas-datagrid` `Popover`. `children` is the trigger,
 * `content` is the floating panel.
 */
export function Popover({
  children,
  content,
  className,
  open,
  onOpenChange,
  triggerClass,
  asChild,
  ...props
}: PopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.PopoverTrigger
        className={triggerClass}
        asChild={asChild}
      >
        {children}
      </PopoverPrimitive.PopoverTrigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          {...props}
          className={className}
          children={content}
        />
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
