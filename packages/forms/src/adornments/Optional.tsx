"use client";

import { useEffect } from "react";
import { controls } from "@rxc/controls";
import {
  ControlAdornmentType,
  type OptionalAdornment as OptionalAdornmentDef,
} from "@rxc/forms-core";
import type { Control } from "@rxc/controls-core";
import type {
  AdornmentRegistration,
  AdornmentRenderProps,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../useHtmlTheme";

const DEFAULT_WRAPPER = "flex items-start gap-2";
const DEFAULT_CHECK = "mt-2";

const OptionalAdornmentRender = controls<
  AdornmentRenderProps<OptionalAdornmentDef>
>("OptionalAdornment", ({ adornment, node, children }, { rc, update, controlContext }) => {
  const { data } = node.getState(rc);
  const optTheme = useHtmlTheme().adornment?.optional ?? {};

  const allowNull = adornment.allowNull !== false;
  const editSelectable = !!adornment.editSelectable;

  // Per-node editing toggle. With `editSelectable`, defaults to "not
  // editing" so the inner control is disabled until the user opts in.
  // Without `editSelectable`, defaults to true.
  const editing = node.ensureMeta<Control<boolean>>("$optional/editing", () =>
    controlContext.newControl<boolean>(!editSelectable),
  );

  if (!data) return <>{children}</>;
  const value = rc.getValue(data);
  const isNull = value == null;
  const isEditing = rc.getValue(editing);

  const shouldDisable = editSelectable && !isEditing;
  // Drive the FormStateNode's force-disabled flag so the inner renderer
  // (and any descendant) reflects the editing/null state through the
  // normal `state.disabled` cascade.
  useEffect(() => {
    node.setForceDisabled(shouldDisable);
    return () => node.setForceDisabled(false);
  }, [node, shouldDisable]);

  return (
    <div className={optTheme.className ?? DEFAULT_WRAPPER}>
      {editSelectable && (
        <input
          type="checkbox"
          checked={isEditing}
          onChange={(e) =>
            update((wc) => wc.setValue(editing, e.target.checked))
          }
          className={optTheme.checkClass ?? DEFAULT_CHECK}
          aria-label="Edit"
        />
      )}
      {allowNull && (
        <input
          type="checkbox"
          checked={!isNull}
          disabled={editSelectable && !isEditing}
          onChange={(e) => {
            const present = e.target.checked;
            update((wc) => wc.setValue(data, present ? "" : null));
          }}
          className={optTheme.checkClass ?? DEFAULT_CHECK}
          aria-label="Has value"
        />
      )}
      <div
        className={optTheme.childWrapperClass ?? "flex-1"}
        style={{ opacity: isNull || shouldDisable ? 0.4 : 1 }}
      >
        {children}
      </div>
    </div>
  );
});

export const OptionalAdornment: AdornmentRegistration<OptionalAdornmentDef> = {
  type: ControlAdornmentType.Optional,
  kind: "control",
  priority: 0,
  render: OptionalAdornmentRender,
};
