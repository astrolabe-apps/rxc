"use client";

import { useId, useMemo } from "react";
import { controls } from "@rxc/controls";
import {
  ControlDefinitionType,
  isDisplayControl,
} from "@rxc/forms-core";
import {
  DesignModeProvider,
  indexAdornments,
  pickActionRenderer,
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
  useLabelText,
  useRegistry,
  wrapAdornments,
} from "@rxc/forms-react-core";
import { useLayout } from "./Layout";
import { useVisibility } from "./Visibility";
import { useLabel } from "./Label";
import { useError } from "./Error";
import type { FieldProps } from "./types";

/**
 * Render a single FormStateNode.
 *
 * Picks a renderer from the registry by the definition's `type` (Data /
 * Group / Action / Display); composes adornments by `kind` (`label`
 * wraps the label, `control` wraps the renderer's output, `field` wraps
 * the entire Layout); wraps in Layout, then in Visibility.
 *
 * Wrap order outermost → innermost: Visibility → field-kind adornments →
 * Layout → control-kind adornments → renderer. Label-kind adornments
 * wrap the label inside Layout.
 */
export const Field = controls<FieldProps>(
  "Field",
  (
    {
      node,
      layout: layoutProp,
      visibility: visibilityProp,
      label: labelProp,
      error: errorProp,
      designMode,
      inline,
    },
    { rc },
  ) => {
    const state = node.getState(rc);
    const ctxLayout = useLayout();
    const ctxVisibility = useVisibility();
    const ctxLabel = useLabel();
    const ctxError = useError();
    const Layout = layoutProp ?? ctxLayout;
    const Visibility = visibilityProp ?? ctxVisibility;
    const Label = labelProp ?? ctxLabel;
    const Error = errorProp ?? ctxError;
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

    // Inline mode: render the renderer output directly. No Layout wrap,
    // no label, no error slot, no adornments. Visibility still applies
    // (hidden subtrees collapse to null) so dynamic show/hide inside an
    // inline group works. Used by `InlineGroupRenderer` for legacy
    // parity, where inline-group children are composed as raw inline
    // content with no per-child wrapper.
    if (inline) {
      if (state.visible === false) return null;
      return inner;
    }

    // Build label (suppressed when the renderer absorbs it)
    const labelText = hidesLabel ? null : useLabelText(node, rc);
    const labelEl =
      labelText != null ? (
        <Label node={node} htmlFor={id} id={`${id}-label`}>
          {labelText}
        </Label>
      ) : null;

    // Compose adornments by kind. Label-kind adornments are composed
    // inside the Label component itself — `labelEl` is already
    // adorned (or null when the renderer is `hidesLabel`).
    const adornmentList = state.definition.adornments ?? [];
    const adornmentMap = useMemo(
      () => indexAdornments(registry.adornments),
      [registry.adornments],
    );
    const decoratedInner = wrapAdornments(
      adornmentList,
      adornmentMap,
      "control",
      inner,
      node,
    );

    const layoutEl = (
      <Layout
        node={node}
        label={labelEl}
        error={<Error node={node} id={errorId} />}
      >
        {decoratedInner}
      </Layout>
    );

    const tree = (
      <Visibility visible={state.visible}>
        {wrapAdornments(adornmentList, adornmentMap, "field", layoutEl, node)}
      </Visibility>
    );

    // If a per-Field designMode override is set, install it as a context
    // for the subtree so nested adornments and renderers see the correct
    // value. Otherwise inherit ambient design mode from upstream.
    return designMode === undefined ? (
      tree
    ) : (
      <DesignModeProvider value={designMode}>{tree}</DesignModeProvider>
    );
  },
);
