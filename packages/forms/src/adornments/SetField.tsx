"use client";

import { useEffect, useRef } from "react";
import { controls } from "@rxc/controls";
import {
  ControlAdornmentType,
  type SetFieldAdornment as SetFieldAdornmentDef,
} from "@rxc/forms-core";
import type { AdornmentRegistration, AdornmentRenderProps } from "@rxc/forms-react-core";
import { useExpression } from "@rxc/forms-react-core";

/**
 * Evaluates an expression against the parent data context and writes the
 * result into a *sibling* field on the same data record. Phase 3 wires
 * the evaluation through `useExpression` (synchronous Data expressions
 * only — Jsonata follows in a later phase).
 *
 * `defaultOnly: true` writes only when the target is currently null, so
 * the user's edits aren't clobbered.
 */
const SetFieldAdornmentRender = controls<
  AdornmentRenderProps<SetFieldAdornmentDef>
>("SetFieldAdornment", ({ adornment, node, children }, { rc, update }) => {
  const evaluated = useExpression(rc, node, adornment.expression);
  const lastWritten = useRef<unknown>(undefined);

  // Resolve target sibling control via the parent data cursor.
  const parentCursor = node.parent.cursor(rc);
  const targetCursor = parentCursor.childField(adornment.field);
  const targetControl = targetCursor?.control;
  const targetValue = targetControl ? rc.getValue(targetControl) : undefined;
  const defaultOnly = !!adornment.defaultOnly;

  useEffect(() => {
    if (!targetControl) return;
    if (evaluated === undefined) return;
    if (defaultOnly && targetValue != null) return;
    if (lastWritten.current === evaluated) return;
    lastWritten.current = evaluated;
    update((wc) => wc.setValue(targetControl, evaluated));
  }, [targetControl, evaluated, defaultOnly, targetValue, update]);

  return <>{children}</>;
});

export const SetFieldAdornment: AdornmentRegistration<SetFieldAdornmentDef> = {
  type: ControlAdornmentType.SetField,
  kind: "field",
  priority: 0,
  render: SetFieldAdornmentRender,
};
