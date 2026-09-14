"use client";

import { memo, useId, useMemo } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  ControlDefinitionType,
  isDisplayControl,
} from "@rx-controls/forms-core";
import {
  indexAdornments,
  pickDataRenderer,
  pickDisplayRenderer,
  pickGroupRenderer,
  resolveLabelText,
  useRegistry,
  wrapAdornments,
} from "@rx-controls/forms-react-core";
import { FieldAction } from "./FieldAction";
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
function FieldRender({ node, inline }: FieldProps): Rendered {
  const { rc, rendered } = useReactive();
  const state = node.getState(rc);
  const Layout = useLayout();
  const Visibility = useVisibility();
  const Label = useLabel();
  const Error = useError();
  const registry = useRegistry();
  const id = useId();
  const errorId = `${id}-error`;

  // Hoisted above the `inline` bail-out below — `useMemo` is a hook and the
  // returns further down are conditional.
  const adornmentMap = useMemo(
    () => indexAdornments(registry.adornments),
    [registry.adornments],
  );

  // Pick the renderer + dispatch metadata
  const def = state.definition;
  let hidesLabel = false;
  let inner: React.ReactNode = null;

  switch (def.type) {
    case ControlDefinitionType.Data: {
      const match = pickDataRenderer(registry.data, node, rc);
      if (match) {
        hidesLabel = !!match.hidesLabel;
        inner = <match.component node={node} id={id} inline={inline} />;
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
      // Delegated to `FieldAction` because the dispatch hooks
      // (`useActionHandler` / `useAsyncAction`) would otherwise live
      // inside this `switch` case — fine in practice (def.type is
      // stable per FormStateNode) but technically a rules-of-hooks
      // landmine if a node ever changed type between renders.
      inner = <FieldAction node={node} />;
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
      `[@rx-controls/forms] No renderer matched for ${def.type} node`,
      def,
    );
    return rendered(null);
  }

  // Inline mode: render the renderer output directly. No Layout wrap,
  // no label, no error slot, no adornments. Visibility still applies
  // (hidden subtrees collapse to null) so dynamic show/hide inside an
  // inline group works. Used by `InlineGroupRenderer` for legacy
  // parity, where inline-group children are composed as raw inline
  // content with no per-child wrapper.
  if (inline) {
    if (state.visible === false) return rendered(null);
    return rendered(inner);
  }

  // Build label (suppressed when the renderer absorbs it)
  const labelText = hidesLabel ? null : resolveLabelText(node, rc);
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

  return rendered(
    <Visibility visible={state.visible}>
      {wrapAdornments(adornmentList, adornmentMap, "field", layoutEl, node)}
    </Visibility>
  );
}

/**
 * Memoized so an ancestor re-render (a parent group re-rendering because
 * its child-list / visibility / disabled state changed) does **not**
 * cascade into every descendant Field. `FormStateNode` is a stable handle,
 * so the `node` prop is referentially stable across renders — a Field only
 * re-renders when its own reactive subscription fires or its props actually
 * change. (See `test/memoBenchmark.test.tsx`: this turns a 500-field
 * ancestor cascade from 500 renders into 0. Relies on the `Form`-provided
 * contexts being referentially stable, since memo makes Field a bailout
 * boundary that context updates punch through.)
 */
export const Field = memo(FieldRender);
