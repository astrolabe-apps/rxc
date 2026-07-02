"use client";

import { useEffect, useRef } from "react";
import { controls } from "@rxc/controls";
import {
  type ArrayElementRenderOptions,
  type FormStateNode,
  isDataControl,
} from "@rxc/forms-core";
import {
  Action,
  rendererClass,
  useDesignMode,
  getExternalEdit,
  type ActionRendererProps,
  type DataRendererProps,
  type ExternalEditAction,
} from "@rxc/forms-react-core";
import { Field } from "../../Field";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Wrap a staged-edit action's `onClick` with draft validation, unless it
 * opts out (`dontValidate` — Cancel does). Mirrors the legacy
 * `ArrayElementRenderer`'s `applyValidation`: touch every draft node so
 * errors surface, and only run the action's `onClick` (the raw commit)
 * when the draft validates.
 */
function applyValidation(
  a: ExternalEditAction,
  draftForm: FormStateNode,
): ActionRendererProps {
  if (a.dontValidate) return a.action;
  return {
    ...a.action,
    onClick: () => {
      draftForm.setTouched(true);
      if (draftForm.validate()) a.action.onClick();
    },
  };
}

/**
 * `renderType: ArrayElement` host for the `editExternal` staged-edit
 * flow. This is the faithful port of the legacy
 * `@react-typed-forms/schemas-html` `ArrayElementRenderer` — it is the
 * ONLY meaning `DataRenderType.ArrayElement` carries (legacy does not
 * use the render type for anything else; see CLAUDE.md "Legacy
 * semantics only").
 *
 * Bound to a collection field via a `dataControl(arrayField, ...,
 * { renderOptions: { type: ArrayElement } })` that's a SIBLING of the
 * `renderType: Array` (or DataGrid) control. Both controls resolve to
 * the same underlying array `Control`, so `getExternalEdit(node)`
 * returns the same controller the Array/DataGrid Add/Edit buttons
 * drive. The staged-edit session the Array's Add/Edit buttons create is
 * displayed here.
 *
 * Renders nothing until a session exists, then:
 *
 * - **default** — pops a native `<dialog>` with the draft form + the
 *   session's staged actions (Cancel + confirm).
 * - **`showInline: true` (or design mode)** — renders the draft body
 *   inline with no dialog chrome, matching legacy
 *   `if (renderOptions.showInline || designMode) return editContent`.
 *
 * The Cancel + confirm actions are **staged by the controller on the
 * session** (`session.actions` — legacy's
 * `getExternalEditData(control).fields.actions`), not hardcoded here;
 * this host just maps them through `<Action>` with the
 * `applyValidation` wrapper. The modal applies for both `add` and
 * `edit` sessions.
 */
export const ArrayElementModalHostRenderer = controls<DataRendererProps>(
  "ArrayElementModalHostRenderer",
  ({ node, id }, { rc }) => {
    const { definition } = node.getState(rc);
    const arrayTheme = useHtmlTheme().data.array;
    const designMode = useDesignMode();

    const renderOptions = isDataControl(definition)
      ? (definition.renderOptions as ArrayElementRenderOptions | undefined)
      : undefined;
    const inline = !!renderOptions?.showInline || designMode;

    const editController = getExternalEdit(node);
    const session = editController.session(rc);

    const dialogRef = useRef<HTMLDialogElement | null>(null);
    useEffect(() => {
      if (inline) return;
      const el = dialogRef.current;
      if (!el) return;
      if (session && !el.open) el.showModal();
      if (!session && el.open) el.close();
    }, [session, inline]);

    const className = isDataControl(definition)
      ? rendererClass(definition.styleClass, undefined)
      : undefined;

    // The Cancel + confirm actions come from the session (staged by the
    // controller — legacy's `getExternalEditData(control).fields.actions`),
    // NOT hardcoded here. Each renders through `<Action>` so the host's
    // registry decides chrome (override per id via
    // `matchActionId("apply", ...)`), matching legacy's
    // `formRenderer.renderAction(applyValidation(c.value))`.
    const content = session ? (
      <div className={arrayTheme.dialogBodyClass}>
        <Field node={session.draftForm} />
        <div className={className ?? arrayTheme.actionsClass}>
          {session.actions.map((a, i) => {
            const props = applyValidation(a, session.draftForm);
            return <Action key={props.actionId || i} {...props} />;
          })}
        </div>
      </div>
    ) : null;

    // Inline (and design) mode: render the draft body directly, no
    // dialog chrome — matches legacy `showInline || designMode`.
    if (inline) {
      return content ? <div id={id}>{content}</div> : null;
    }

    return (
      <dialog
        id={id}
        ref={dialogRef}
        onClose={() => editController.cancel()}
        className={arrayTheme.dialogClass}
      >
        {content}
      </dialog>
    );
  },
);
