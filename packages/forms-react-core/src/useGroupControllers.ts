"use client";

import { useState } from "react";
import type { ReadContext } from "@rx-controls/core";
import {
  isGroupControl,
  type DialogRenderOptions,
  type FormStateNode,
} from "@rx-controls/forms-core";

/**
 * Platform-agnostic open/active-state controllers for the stateful group
 * renderers (Tabs, Dialog, AccordionGroup sections). Each owns the state
 * machine + child partitioning; the platform renderer owns element choice,
 * theme classes, and any imperative platform API (native `<dialog>`,
 * `<details>`). RN reuses the state shape and swaps the chrome.
 *
 * Contract: `(rc, node)`.
 */

// ── Tabs ────────────────────────────────────────────────────────────────

export interface TabInfo {
  node: FormStateNode;
  title: string;
  active: boolean;
}

export interface TabsController {
  styleClass: string | null | undefined;
  visibleChildren: FormStateNode[];
  /** Clamped active index (falls back to 0 if the stored index is stale). */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  tabs: TabInfo[];
  activeChild: FormStateNode | undefined;
}

export function useTabsController(
  rc: ReadContext,
  node: FormStateNode,
): TabsController {
  const { definition } = node.getState(rc);
  const [active, setActive] = useState(0);
  const visibleChildren = node
    .getChildren(rc)
    .filter((c) => c.getState(rc).visible !== false);
  const activeIndex = active < visibleChildren.length ? active : 0;
  const tabs: TabInfo[] = visibleChildren.map((c, i) => ({
    node: c,
    title: c.getState(rc).definition.title ?? `Tab ${i + 1}`,
    active: i === activeIndex,
  }));
  return {
    styleClass: definition.styleClass,
    visibleChildren,
    activeIndex,
    setActiveIndex: setActive,
    tabs,
    activeChild: visibleChildren[activeIndex],
  };
}

// ── Dialog ────────────────────────────────────────────────────────────────

export interface DisclosureController {
  styleClass: string | null | undefined;
  title: string | null;
  /** Children with `placement === "trigger"` — render inline. */
  triggerChildren: FormStateNode[];
  /** Everything else — render inside the modal. */
  contentChildren: FormStateNode[];
  open: boolean;
  setOpen: (open: boolean) => void;
  /** ActionScope `onAction` handler: claims `openDialog` / `closeDialog`. */
  handleAction: (id: string) => boolean | undefined;
}

export function useDisclosure(
  rc: ReadContext,
  node: FormStateNode,
): DisclosureController {
  const def = node.getState(rc).definition;
  const opts = isGroupControl(def)
    ? (def.groupOptions as DialogRenderOptions | undefined)
    : undefined;
  const children = node.getChildren(rc);
  const [open, setOpen] = useState(false);
  return {
    styleClass: def.styleClass,
    title: opts?.title ?? null,
    triggerChildren: children.filter(
      (c) => c.getState(rc).definition.placement === "trigger",
    ),
    contentChildren: children.filter(
      (c) => c.getState(rc).definition.placement !== "trigger",
    ),
    open,
    setOpen,
    handleAction: (id) => {
      if (id === "openDialog") {
        setOpen(true);
        return true;
      }
      if (id === "closeDialog") {
        setOpen(false);
        return true;
      }
      return undefined;
    },
  };
}

// ── Accordion section ──────────────────────────────────────────────────

export interface AccordionSectionController {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
}

export function useAccordionSection(
  rc: ReadContext,
  node: FormStateNode,
): AccordionSectionController {
  const def = node.getState(rc).definition;
  const [open, setOpen] = useState(false);
  return { open, setOpen, title: def.title ?? "Section" };
}
