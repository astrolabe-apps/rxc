"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import {
  GroupRenderType,
  isGroupControl,
  type FormStateNode,
  type WizardRenderOptions,
} from "@rx-controls/forms-core";

export interface WizardStepInfo {
  /** 0-based step index over visible-only steps. Hidden steps reuse the
   * preceding visible step's index. */
  index: number;
  /** Step title — defaults to "Step {n}" when the child has no title. */
  title: string;
  visible: boolean;
  active: boolean;
  completed: boolean;
  valid: boolean;
  node: FormStateNode;
}

export interface WizardController {
  /** Currently-displayed child index in the unfiltered child list. */
  currentPage: number;
  /** All page children (excludes children with `placement` set). */
  pageChildren: FormStateNode[];
  /** Step info per page child. */
  steps: WizardStepInfo[];
  /** Visible-only count of pages. */
  totalVisible: number;
  /** Visible-only index of the currently-displayed page. */
  visibleIndex: number;
  hasNext: boolean;
  hasPrev: boolean;
  /** Optional placement-based subgroups. Children with
   * `definition.placement` of "leftNav" / "middleNav" / "rightNav" are
   * pulled out so a renderer can position them around the page. */
  leftNav: FormStateNode[];
  middleNav: FormStateNode[];
  rightNav: FormStateNode[];
  /** Configured options pulled from the group's render options. */
  showSteps: boolean;
  manualNavigation: boolean;

  goToPage(index: number): void;
  next(validate?: boolean): boolean;
  prev(): boolean;
  /** Validate the current page and mark its tree as touched. */
  validatePage(): boolean;
}

const PLACEMENTS = new Set(["leftNav", "middleNav", "rightNav"]);

/**
 * Step controller for `GroupRenderType.Wizard` groups.
 *
 * Resolves the page-index Control — using the user-provided
 * `pageIndexField` data binding when set, otherwise an internal Control
 * scoped to this hook call site. Exposes step info and navigation
 * helpers; the consuming renderer drives chrome (step indicator, next /
 * prev buttons) off the returned state.
 */
export function useWizardController(
  rc: ReadContext,
  node: FormStateNode,
): WizardController {
  const ctx = useControlContext();
  const state = node.getState(rc);
  const definition = state.definition;
  const opts =
    isGroupControl(definition) &&
    definition.groupOptions?.type === GroupRenderType.Wizard
      ? (definition.groupOptions as WizardRenderOptions)
      : undefined;
  const showSteps = !!opts?.showSteps;
  const manualNavigation = !!opts?.manualNavigation;

  const allChildren = node.getChildren(rc);
  const leftNav: FormStateNode[] = [];
  const middleNav: FormStateNode[] = [];
  const rightNav: FormStateNode[] = [];
  const pageChildren: FormStateNode[] = [];
  for (const c of allChildren) {
    const placement = (c.getState(rc).definition as { placement?: string })
      .placement;
    if (placement === "leftNav") leftNav.push(c);
    else if (placement === "middleNav") middleNav.push(c);
    else if (placement === "rightNav") rightNav.push(c);
    else if (!placement || placement === "content") pageChildren.push(c);
    else if (!PLACEMENTS.has(placement)) pageChildren.push(c);
  }

  const pageFieldRef = opts?.pageIndexField;
  const externalControl = pageFieldRef
    ? resolvePageControl(rc, node, pageFieldRef)
    : undefined;

  const internalRef = useRef<Control<number> | null>(null);
  if (!internalRef.current) {
    internalRef.current = ctx.newControl<number>(0);
  }
  const pageControl = (externalControl ?? internalRef.current) as Control<number>;
  const rawPage = (rc.getValue(pageControl) ?? 0) as number;
  const childrenLength = pageChildren.length;
  const currentPage =
    childrenLength === 0
      ? 0
      : Math.max(0, Math.min(rawPage, childrenLength - 1));

  const steps = useMemo(() => buildSteps(), [pageChildren, currentPage]);

  function buildSteps(): WizardStepInfo[] {
    const result: WizardStepInfo[] = [];
    let visibleIndex = 0;
    for (let i = 0; i < childrenLength; i++) {
      const child = pageChildren[i];
      const cs = child.getState(rc);
      const visible = !!cs.visible;
      result.push({
        index: visibleIndex,
        title: cs.definition.title ?? `Step ${visibleIndex + 1}`,
        visible,
        active: i === currentPage,
        completed: visible && i < currentPage,
        valid: cs.valid,
        node: child,
      });
      if (visible) visibleIndex++;
    }
    return result;
  }

  function nextVisibleInDirection(dir: number): number | null {
    let next = currentPage + dir;
    while (next >= 0 && next < childrenLength) {
      if (pageChildren[next].getState(rc).visible) return next;
      next += dir;
    }
    return null;
  }

  const hasNext = nextVisibleInDirection(1) != null;
  const hasPrev = nextVisibleInDirection(-1) != null;

  function setPage(p: number) {
    ctx.update((wc) => wc.setValue(pageControl, p));
  }

  function validatePage(): boolean {
    const pageNode = pageChildren[currentPage];
    if (!pageNode) return false;
    const valid = pageNode.validate();
    pageNode.setTouched(true);
    return valid;
  }

  function next(validate?: boolean): boolean {
    if (validate && !validatePage()) return false;
    const n = nextVisibleInDirection(1);
    if (n == null) return false;
    setPage(n);
    return true;
  }

  function prev(): boolean {
    const p = nextVisibleInDirection(-1);
    if (p == null) return false;
    setPage(p);
    return true;
  }

  // If the current page becomes invisible (e.g. dynamically hidden),
  // hop to the nearest visible page.
  useEffect(() => {
    if (childrenLength === 0) return;
    const cur = pageChildren[currentPage];
    if (cur && cur.getState(rc).visible) return;
    const fwd = nextVisibleInDirection(1);
    const back = nextVisibleInDirection(-1);
    const target = fwd ?? back;
    if (target != null) setPage(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, childrenLength]);

  let visibleIndex = 0;
  for (let i = 0; i < currentPage && i < childrenLength; i++) {
    if (pageChildren[i].getState(rc).visible) visibleIndex++;
  }
  const totalVisible = steps.filter((s) => s.visible).length;

  return {
    currentPage,
    pageChildren,
    steps,
    totalVisible,
    visibleIndex,
    hasNext,
    hasPrev,
    leftNav,
    middleNav,
    rightNav,
    showSteps,
    manualNavigation,
    goToPage: setPage,
    next,
    prev,
    validatePage,
  };
}

/**
 * Resolve `pageIndexField` (a `field` ref string with optional
 * `..` parents) into a sibling Control on the form's data context.
 * Falls back to `undefined` when the path doesn't resolve, and the
 * caller switches to an internal Control.
 */
function resolvePageControl(
  rc: ReadContext,
  node: FormStateNode,
  fieldRef: string,
): Control<number> | undefined {
  let cursor = node.parent.cursor(rc);
  for (const seg of fieldRef.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!cursor.parent) return undefined;
      cursor = cursor.parent;
      continue;
    }
    const next = cursor.childField?.(seg);
    if (!next) return undefined;
    cursor = next;
  }
  return cursor.control as Control<number> | undefined;
}
