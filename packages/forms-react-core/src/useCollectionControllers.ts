"use client";

import type { Control, ReadContext } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import {
  type ArrayRenderOptions,
  isDataControl,
  type LengthValidator,
  type ScrollListRenderOptions,
  ValidatorType,
  type FormStateNode,
} from "@rx-controls/forms-core";
import { useActionHandler } from "./ActionScope";
import { getExternalEdit } from "./getExternalEdit";
import type { ActionRendererProps } from "./types";

/**
 * Platform-agnostic controllers for collection-data renderers (Array,
 * ScrollList). They resolve length constraints, action ids/text, the
 * editExternal flow, and the paging trigger — returning `ActionRendererProps`
 * POJOs + handlers. DOM element choice, theme classes, and the
 * `IntersectionObserver` sentinel stay in the platform renderer.
 *
 * Contract: `(rc, node)`, writes via `useControlContext().update`.
 */

// ── Array add / edit / remove ──────────────────────────────────────────

interface ArrayLengthRange {
  min: number;
  max: number;
}

function getLengthRange(
  validators: { type: string }[] | null | undefined,
): ArrayLengthRange {
  let min = 0;
  let max = Infinity;
  if (!validators) return { min, max };
  for (const v of validators) {
    if (v.type === ValidatorType.Length) {
      const lv = v as LengthValidator;
      if (lv.min != null) min = lv.min;
      if (lv.max != null) max = lv.max;
    }
  }
  return { min, max };
}

export interface ArrayRowActions {
  /** Edit button props — only present in the editExternal flow. */
  edit: ActionRendererProps | null;
  remove: ActionRendererProps;
}

export interface ArrayActionsController {
  data: Control<unknown> | undefined;
  styleClass: string | null | undefined;
  children: FormStateNode[];
  /** Per-child (index-aligned with `children`) edit/remove action props. */
  rowActions: ArrayRowActions[];
  /** Add button props (null only when the node has no bound data). */
  addAction: ActionRendererProps | null;
}

/**
 * Controller for the Array renderer. Each button's `onClick` dispatches its
 * configured action id through the `<ActionScope>` chain first (so hosts can
 * intercept), falling back to the default mutation — `wc.addElement` /
 * `wc.removeElement` for the plain flow, or `beginAdd` / `beginEdit` against
 * the shared `getExternalEdit` controller for the editExternal flow.
 */
export function useArrayActions(
  rc: ReadContext,
  node: FormStateNode,
): ArrayActionsController {
  const ctx = useControlContext();
  const dispatch = useActionHandler();
  const { data, definition } = node.getState(rc);
  if (!data) {
    return {
      data: undefined,
      styleClass: definition.styleClass,
      children: [],
      rowActions: [],
      addAction: null,
    };
  }

  const children = node.getChildren(rc);
  const validators = isDataControl(definition)
    ? definition.validators
    : undefined;
  const { min, max } = getLengthRange(validators);
  const len = children.length;

  const ro = isDataControl(definition)
    ? (definition.renderOptions as Partial<ArrayRenderOptions> | undefined)
    : undefined;
  const editExternal = !!ro?.editExternal;
  const addActionId = ro?.addActionId ?? "add";
  const editActionId = ro?.editActionId ?? "edit";
  const removeActionId = ro?.removeActionId ?? "remove";
  const addText = ro?.addText ?? "Add";
  const editText = ro?.editText ?? "Edit";
  const removeText = ro?.removeText ?? "Remove";

  // Controller is shared across sibling renderers via `arrayControl.meta`.
  const editController = getExternalEdit(node);

  const runWithDispatch = async (
    actionId: string,
    actionData: unknown,
    fallback: () => void,
  ) => {
    const handled = await dispatch(actionId, actionData);
    if (!handled) fallback();
  };

  const rowActions: ArrayRowActions[] = children.map((_child, i) => ({
    edit: editExternal
      ? {
          actionId: editActionId,
          actionText: editText,
          onClick: () => {
            void runWithDispatch(editActionId, { index: i }, () =>
              editController.beginEdit(i),
            );
          },
        }
      : null,
    remove: {
      actionId: removeActionId,
      actionText: removeText,
      disabled: len <= min,
      onClick: () => {
        void runWithDispatch(removeActionId, { index: i }, () => {
          ctx.update((wc) =>
            wc.removeElement(
              data as Parameters<typeof wc.removeElement>[0],
              i,
            ),
          );
        });
      },
    },
  }));

  const addAction: ActionRendererProps = {
    actionId: addActionId,
    actionText: addText,
    disabled: len >= max,
    onClick: () => {
      void runWithDispatch(addActionId, undefined, () => {
        if (editExternal) {
          editController.beginAdd();
          return;
        }
        ctx.update((wc) =>
          wc.addElement(data as Parameters<typeof wc.addElement>[0], null),
        );
      });
    },
  };

  return {
    data,
    styleClass: definition.styleClass,
    children,
    rowActions,
    addAction,
  };
}

// ── ScrollList paging ──────────────────────────────────────────────────

export interface ScrollListController {
  data: Control<unknown> | undefined;
  styleClass: string | null | undefined;
  children: FormStateNode[];
  loading: boolean;
  hasMore: boolean;
  /** True when the sentinel should observe (more to load, not mid-fetch,
   *  and an action id is configured). */
  sentinelEnabled: boolean;
  /** Fire the configured `bottomActionId` (no-op when unconfigured). */
  onSentinelVisible: () => void;
}

/**
 * Controller for the ScrollList renderer. Reads the host-maintained
 * `$scrollList.{loading,hasMore}` meta on the bound control and exposes the
 * paging trigger; the platform renderer owns the sentinel element +
 * `IntersectionObserver`.
 */
export function useScrollListController(
  rc: ReadContext,
  node: FormStateNode,
): ScrollListController {
  const dispatch = useActionHandler();
  const { data, definition } = node.getState(rc);
  const ro =
    data && isDataControl(definition)
      ? (definition.renderOptions as ScrollListRenderOptions | undefined)
      : undefined;
  const bottomActionId = ro?.bottomActionId;
  const meta = (data?.meta ?? {}) as {
    $scrollList?: { loading?: boolean; hasMore?: boolean };
  };
  const loading = !!meta.$scrollList?.loading;
  const hasMore = !!meta.$scrollList?.hasMore;
  return {
    data,
    styleClass: definition.styleClass,
    children: data ? node.getChildren(rc) : [],
    loading,
    hasMore,
    sentinelEnabled: hasMore && !loading && !!bottomActionId,
    onSentinelVisible: () => {
      if (!bottomActionId) return;
      void Promise.resolve(dispatch(bottomActionId, undefined));
    },
  };
}
