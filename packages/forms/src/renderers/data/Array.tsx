"use client";

import { controls } from "@rxc/controls";
import {
  type ArrayRenderOptions,
  isDataControl,
  type LengthValidator,
  ValidatorType,
} from "@rxc/forms-core";
import { Field } from "../../Field";
import type {
  ActionRendererProps,
  DataRendererProps,
} from "@rxc/forms-react-core";
import {
  Action,
  rendererClass,
  useActionHandler,
  getExternalEdit,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";


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

/**
 * Renders a list of array elements (one per child) plus Add / per-row
 * Edit / per-row Remove buttons.
 *
 * **Action rendering**: each button is dispatched as plain
 * {@link ActionRendererProps} through `pickActionRenderer` so the
 * host's registry decides the chrome — by default `ButtonAction`, or
 * any per-id override the host registered via
 * `matchActionId(addActionId, MyAddRenderer)`. No FormStateNode is
 * synthesized for the inline buttons; this mirrors the legacy
 * `@react-typed-forms/schemas-html` `DefaultArrayRenderer` which
 * passes `{ actionId, actionText, onClick, disabled, ... }` POJOs to
 * `renderAction`.
 *
 * **Action ids / text** are read from `renderOptions`
 * (`ArrayRenderOptions`): `addActionId` (default `"add"`),
 * `editActionId` (`"edit"`), `removeActionId` (`"remove"`); plus
 * matching `*Text` fields for labels.
 *
 * **Click behavior**: each `onClick` dispatches the configured
 * actionId through `useActionHandler` (so hosts can intercept via
 * `<ActionScope>`); when no scope claims, falls back to the default —
 * `wc.addElement` / `wc.removeElement` for the non-editExternal flow,
 * or `beginAdd` / `beginEdit` against the shared `getExternalEdit`
 * controller for the editExternal flow.
 *
 * **editExternal**: the per-row Edit button only renders when
 * `renderOptions.editExternal` is set. The modal that displays the
 * staged draft is rendered by a sibling `renderType: ArrayElement`
 * data control bound to the same array field — see
 * `ArrayElementModalHostRenderer`. Without the sibling, clicking Add
 * or Edit stages a draft that has no UI host.
 */
export const ArrayRenderer = controls<DataRendererProps>(
  "ArrayRenderer",
  ({ node }, { rc, update }) => {
    const { data, definition } = node.getState(rc);
    const arrayTheme = useHtmlTheme().data?.array ?? {};
    const dispatch = useActionHandler();
    if (!data) return null;

    const children = node.getChildren(rc);
    const validators = isDataControl(definition)
      ? definition.validators
      : undefined;
    const { min, max } = getLengthRange(validators);
    const len = children.length;

    const wrapperClass = rendererClass(
      definition.styleClass,
      arrayTheme.className,
    );

    const arrayRenderOpts = isDataControl(definition)
      ? (definition.renderOptions as Partial<ArrayRenderOptions> | undefined)
      : undefined;
    const editExternal = !!arrayRenderOpts?.editExternal;
    const addActionId = arrayRenderOpts?.addActionId ?? "add";
    const editActionId = arrayRenderOpts?.editActionId ?? "edit";
    const removeActionId = arrayRenderOpts?.removeActionId ?? "remove";
    const addText = arrayRenderOpts?.addText ?? "Add";
    const editText = arrayRenderOpts?.editText ?? "Edit";
    const removeText = arrayRenderOpts?.removeText ?? "Remove";

    // Controller is shared across sibling renderers via `arrayControl.meta`.
    const editController = getExternalEdit(node);

    // Build click handlers: dispatch via the action scope chain first so
    // hosts can intercept; if no scope claims (handler returns falsy),
    // run the renderer's default behavior.
    const runWithDispatch = async (
      actionId: string,
      data: unknown,
      fallback: () => void,
    ) => {
      const handled = await dispatch(actionId, data);
      if (!handled) fallback();
    };

    return (
      <div className={wrapperClass}>
        {children.map((child, i) => {
          const editProps: ActionRendererProps | null = editExternal
            ? {
                actionId: editActionId,
                actionText: editText,
                onClick: () => {
                  void runWithDispatch(editActionId, { index: i }, () =>
                    editController.beginEdit(i),
                  );
                },
              }
            : null;
          const removeProps: ActionRendererProps = {
            actionId: removeActionId,
            actionText: removeText,
            disabled: len <= min,
            onClick: () => {
              void runWithDispatch(removeActionId, { index: i }, () => {
                update((wc) =>
                  wc.removeElement(
                    data as Parameters<typeof wc.removeElement>[0],
                    i,
                  ),
                );
              });
            },
          };
          return (
            <div
              key={child.uniqueId}
              className={arrayTheme.childClass}
            >
              <div className="flex-1">
                <Field node={child} />
              </div>
              {editProps ? <Action {...editProps} /> : null}
              <Action {...removeProps} />
            </div>
          );
        })}
        <Action
          actionId={addActionId}
          actionText={addText}
          disabled={len >= max}
          onClick={() => {
            void runWithDispatch(addActionId, undefined, () => {
              if (editExternal) {
                editController.beginAdd();
                return;
              }
              update((wc) =>
                wc.addElement(
                  data as Parameters<typeof wc.addElement>[0],
                  null,
                ),
              );
            });
          }}
        />
      </div>
    );
  },
);
