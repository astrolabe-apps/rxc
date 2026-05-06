"use client";

import { controls } from "@rxc/controls";
import {
  ControlAdornmentType,
  type OptionalAdornment as OptionalAdornmentDef,
} from "@rxc/forms-core";
import type { AdornmentRegistration, AdornmentRenderProps } from "../Adornment";

const OptionalAdornmentRender = controls<
  AdornmentRenderProps<OptionalAdornmentDef>
>("OptionalAdornment", ({ adornment, node, children }, { rc, update }) => {
  const { data } = node.getState(rc);
  if (!data) return <>{children}</>;
  const value = rc.getValue(data);
  const isNull = value == null;
  const allowNull = adornment.allowNull !== false;

  return (
    <div className="flex items-start gap-2">
      {allowNull && (
        <input
          type="checkbox"
          checked={!isNull}
          onChange={(e) => {
            const present = e.target.checked;
            update((wc) => wc.setValue(data, present ? "" : null));
          }}
          className="mt-2"
          aria-label="Has value"
        />
      )}
      <div className="flex-1" style={{ opacity: isNull ? 0.4 : 1 }}>
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
