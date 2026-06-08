"use client";

import { controls } from "@rxc/controls";
import { isActionControl, type FormStateNode } from "@rxc/forms-core";
import {
  Action,
  useActionHandler,
  useAsyncAction,
} from "@rxc/forms-react-core";
import { Field } from "./Field";

/**
 * Adapter that renders a form-tree `Action` control through the
 * registry's action matchers.
 *
 * Extracted from `Field.tsx`'s `case ControlDefinitionType.Action`
 * branch because the dispatch hooks (`useActionHandler`,
 * `useAsyncAction`) are called per-render — putting them inside a
 * `switch` case in `Field` would only be safe as long as no node ever
 * changed its `def.type` between renders. As its own component the
 * hook order is unconditional and rules-of-hooks holds.
 *
 * Translates the {@link FormStateNode} → plain `ActionRendererProps`:
 * - `onClick` wraps the dispatch (via {@link useActionHandler}) in
 *   {@link useAsyncAction} so busy state ties back to the node.
 * - `children` is the rendered nested form content (each child via
 *   `<Field>`). `ButtonAction` uses it as the button body when
 *   present; `actionText` is still passed for a11y / tooltips.
 *
 * Hosts customize the visual chrome per id via
 * `matchActionId(actionId, MyRenderer)`; `MyRenderer` receives the
 * same `ActionRendererProps`.
 */
export const FieldAction = controls<{ node: FormStateNode }>(
  "FieldAction",
  ({ node }, { rc }) => {
    const state = node.getState(rc);
    const def = state.definition;
    if (!isActionControl(def)) return null;

    const dispatch = useActionHandler();
    const onClick = useAsyncAction(
      node,
      dispatch,
      def.actionId,
      def.actionData,
      def.disableType ?? undefined,
    );

    const actionChildren = node.getChildren(rc);
    const renderedChildren =
      actionChildren.length > 0 ? (
        <>
          {actionChildren.map((c) => (
            <Field key={c.uniqueId} node={c} />
          ))}
        </>
      ) : undefined;

    return (
      <Action
        actionId={def.actionId}
        actionText={def.title ?? undefined}
        onClick={onClick}
        disabled={state.disabled}
        busy={state.busy}
        icon={def.icon}
        actionStyle={def.actionStyle}
        iconPlacement={def.iconPlacement}
        disableType={def.disableType}
        styleClass={def.styleClass}
        textClass={def.textClass}
      >
        {renderedChildren}
      </Action>
    );
  },
);
