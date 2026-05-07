"use client";

import { useEffect } from "react";
import { controls } from "@rxc/controls";
import {
  AdornmentPlacement,
  ControlAdornmentType,
  type OptionalAdornment as OptionalAdornmentDef,
} from "@rxc/forms-core";
import type { Control } from "@rxc/controls-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../useHtmlTheme";

const DEFAULT_WRAPPER = "flex items-center gap-2 w-full";
const DEFAULT_CHILD_WRAPPER = "grow";
const DEFAULT_NULL_WRAPPER = "inline-flex items-center gap-1 mr-2";
const DEFAULT_CHECK = "m-2";
const DEFAULT_LABEL_WRAP = "inline-flex items-center gap-1";

const OptionalAdornmentRender = controls<
  AdornmentRenderProps<OptionalAdornmentDef>
>(
  "OptionalAdornment",
  ({ adornment, node, children, kind }, { rc, update, controlContext }) => {
    const { data } = node.getState(rc);
    const optTheme = useHtmlTheme().adornment?.optional ?? {};

    const allowNull = adornment.allowNull !== false;
    const editSelectable = !!adornment.editSelectable;
    const placement = adornment.placement ?? AdornmentPlacement.LabelStart;
    const editAtLabel =
      placement === AdornmentPlacement.LabelStart ||
      placement === AdornmentPlacement.LabelEnd;

    // Per-node editing toggle. With `editSelectable`, defaults to "not
    // editing" so the inner control is disabled until the user opts in.
    // Without `editSelectable`, defaults to true.
    const editing = node.ensureMeta<Control<boolean>>(
      "$optional/editing",
      () => controlContext.newControl<boolean>(!editSelectable),
    );

    if (!data) return <>{children}</>;
    const value = rc.getValue(data);
    const isNull = value == null;
    const isEditing = rc.getValue(editing);

    const editCheckbox = editSelectable ? (
      <input
        type="checkbox"
        checked={isEditing}
        onChange={(e) =>
          update((wc) => wc.setValue(editing, e.target.checked))
        }
        className={optTheme.checkClass ?? DEFAULT_CHECK}
        aria-label="Edit"
      />
    ) : null;

    if (kind === "label") {
      if (!editCheckbox || !editAtLabel) return <>{children}</>;
      return (
        <span className={DEFAULT_LABEL_WRAP}>
          {placement === AdornmentPlacement.LabelStart ? editCheckbox : null}
          {children}
          {placement === AdornmentPlacement.LabelEnd ? editCheckbox : null}
        </span>
      );
    }

    // kind === "control"
    // Match legacy: disable the inner field when not editing or when the
    // value is null. Drives the FormStateNode's force-disabled flag so
    // descendants pick it up via the normal `state.disabled` cascade.
    const shouldDisable =
      (editSelectable && !isEditing) || (allowNull && isNull);
    useEffect(() => {
      node.setForceDisabled(shouldDisable);
      return () => node.setForceDisabled(false);
    }, [node, shouldDisable]);

    const inlineEdit =
      editCheckbox && placement === AdornmentPlacement.ControlStart
        ? editCheckbox
        : null;
    const trailingEdit =
      editCheckbox && placement === AdornmentPlacement.ControlEnd
        ? editCheckbox
        : null;

    // Polarity matches legacy `<Fcheckbox notValue>`: checked = null,
    // unchecked = has value.
    const nullToggle = allowNull ? (
      <div className={optTheme.nullWrapperClass ?? DEFAULT_NULL_WRAPPER}>
        <input
          type="checkbox"
          checked={isNull}
          disabled={editSelectable && !isEditing}
          onChange={(e) => {
            const becomingNull = e.target.checked;
            update((wc) => wc.setValue(data, becomingNull ? null : ""));
          }}
          className={optTheme.checkClass ?? DEFAULT_CHECK}
          aria-label="Null"
        />
        <span>{optTheme.setNullText ?? "Null"}</span>
      </div>
    ) : null;

    const defaultBody = (
      <div className={optTheme.className ?? DEFAULT_WRAPPER}>
        {inlineEdit}
        <div className={optTheme.childWrapperClass ?? DEFAULT_CHILD_WRAPPER}>
          {nullToggle}
          {children}
        </div>
        {trailingEdit}
      </div>
    );

    if (optTheme.customRender) {
      return (
        <>
          {optTheme.customRender({
            node,
            data,
            editing,
            isNull,
            isEditing,
            shouldDisable,
            children,
            nullToggle,
            defaultBody,
          })}
        </>
      );
    }

    return defaultBody;
  },
);

export const OptionalAdornment: AdornmentRegistration<OptionalAdornmentDef> = {
  type: ControlAdornmentType.Optional,
  kind: ["label", "control"],
  priority: 0,
  render: OptionalAdornmentRender,
};
