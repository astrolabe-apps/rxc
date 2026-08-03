"use client";

import { useEffect } from "react";
import { useControlContext, useControls, type Rendered } from "@rxc/controls";
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


function OptionalAdornmentRender({
  adornment,
  node,
  children,
  kind,
}: AdornmentRenderProps<OptionalAdornmentDef>): Rendered {
  const { rc, rendered } = useControls();
  const controlContext = useControlContext();
  const { update } = controlContext;
  const { data } = node.getState(rc);
  const optTheme = useHtmlTheme().adornment.optional;

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

  const value = data ? rc.getValue(data) : undefined;
  const isNull = value == null;
  const isEditing = rc.getValue(editing);

  // Match legacy: disable the inner field when not editing or when the
  // value is null. Drives the FormStateNode's force-disabled flag so
  // descendants pick it up via the normal `state.disabled` cascade.
  //
  // Hoisted above every early return: this is a real hook, and the
  // returns below are conditional. (It sat after them while this
  // component was a `controls()` callback, where no lint rule could see
  // the violation.) Gated on `kind`/`data` so the effect is a no-op in
  // the paths that used to skip it entirely.
  const shouldDisable =
    kind === "control" &&
    !!data &&
    ((editSelectable && !isEditing) || (allowNull && isNull));
  useEffect(() => {
    node.setForceDisabled(shouldDisable);
    return () => node.setForceDisabled(false);
  }, [node, shouldDisable]);

  if (!data) return rendered(<>{children}</>);

  const editCheckbox = editSelectable ? (
    <input
      type="checkbox"
      checked={isEditing}
      onChange={(e) =>
        update((wc) => wc.setValue(editing, e.target.checked))
      }
      className={optTheme.checkClass}
      aria-label="Edit"
    />
  ) : null;

  if (kind === "label") {
    if (!editCheckbox || !editAtLabel) return rendered(<>{children}</>);
    return rendered(
      <span className={optTheme.labelWrapClass}>
        {placement === AdornmentPlacement.LabelStart ? editCheckbox : null}
        {children}
        {placement === AdornmentPlacement.LabelEnd ? editCheckbox : null}
      </span>
    );
  }

  // kind === "control"
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
    <div className={optTheme.nullWrapperClass}>
      <input
        type="checkbox"
        checked={isNull}
        disabled={editSelectable && !isEditing}
        onChange={(e) => {
          const becomingNull = e.target.checked;
          update((wc) => wc.setValue(data, becomingNull ? null : ""));
        }}
        className={optTheme.checkClass}
        aria-label="Null"
      />
      <span>{optTheme.setNullText}</span>
    </div>
  ) : null;

  const defaultBody = (
    <div className={optTheme.className}>
      {inlineEdit}
      <div className={optTheme.childWrapperClass}>
        {nullToggle}
        {children}
      </div>
      {trailingEdit}
    </div>
  );

  if (optTheme.customRender) {
    return rendered(
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

  return rendered(defaultBody);
}

export const OptionalAdornment: AdornmentRegistration<OptionalAdornmentDef> = {
  type: ControlAdornmentType.Optional,
  kind: ["label", "control"],
  priority: 0,
  render: OptionalAdornmentRender,
};
