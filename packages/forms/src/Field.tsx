"use client";

import { useId } from "react";
import { controls } from "@rxc/controls";
import {
  ControlDefinitionType,
  isDisplayControl,
  type FormStateNode,
} from "@rxc/forms-core";
import {
  pickActionRenderer,
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
} from "./registry";
import { useRegistry } from "./FormProvider";
import { useLayout } from "./Layout";
import { useVisibility } from "./Visibility";
import { Label } from "./Label";
import { Error } from "./Error";
import { useLabelText } from "./labelText";
import type { FieldProps } from "./types";

/**
 * Render a single FormStateNode. Picks a renderer from the registry by
 * the definition's `type` (Data / Group / Action / Display), then wraps
 * its output in Layout and Visibility.
 *
 * Phase 1: no adornments yet — Field does dispatch + label + Layout +
 * Visibility only. Adornments land in Phase 3.
 */
export const Field = controls<FieldProps>(
  "Field",
  (
    { node, layout: layoutProp, visibility: visibilityProp, designMode: _dm },
    { rc },
  ) => {
    const state = node.getState(rc);
    const ctxLayout = useLayout();
    const ctxVisibility = useVisibility();
    const Layout = layoutProp ?? ctxLayout;
    const Visibility = visibilityProp ?? ctxVisibility;
    const registry = useRegistry();
    const id = useId();
    const errorId = `${id}-error`;

    // Pick the renderer + dispatch metadata
    const def = state.definition;
    let hidesLabel = false;
    let inner: React.ReactNode = null;

    switch (def.type) {
      case ControlDefinitionType.Data: {
        const match = pickDataRenderer(registry.data, node, rc);
        if (match) {
          hidesLabel = !!match.hidesLabel;
          inner = <match.component node={node} id={id} />;
        }
        break;
      }
      case ControlDefinitionType.Group: {
        const match = pickGroupRenderer(registry.group, node, rc);
        if (match) {
          hidesLabel = !!match.hidesLabel;
          inner = <match.component node={node} />;
        }
        break;
      }
      case ControlDefinitionType.Action: {
        const match = pickActionRenderer(registry.action, node, rc);
        if (match) {
          inner = <match.component node={node} />;
        }
        break;
      }
      case ControlDefinitionType.Display: {
        if (isDisplayControl(def)) {
          const match = pickDisplayRenderer(registry.display, def.displayData);
          if (match) {
            inner = <match.component node={node} data={def.displayData} />;
          }
        }
        break;
      }
    }

    if (inner === null) {
      // No matcher hit — fail loudly during dev so missing registrations
      // surface immediately. Production builds may want to swap this for
      // a silent null.
      // eslint-disable-next-line no-console
      console.warn(
        `[@rxc/forms] No renderer matched for ${def.type} node`,
        def,
      );
      return null;
    }

    // Build label (suppressed when the renderer absorbs it)
    const labelText = hidesLabel ? null : useLabelText(node, rc);
    const labelEl =
      labelText != null ? (
        <Label node={node} htmlFor={id}>
          {labelText}
        </Label>
      ) : null;

    return (
      <Visibility visible={state.visible}>
        <Layout
          node={node}
          label={labelEl}
          error={<Error node={node} id={errorId} />}
        >
          {inner}
        </Layout>
      </Visibility>
    );
  },
);
