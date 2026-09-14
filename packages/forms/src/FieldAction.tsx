"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import { isActionControl, type FormStateNode } from "@rx-controls/forms-core";
import {
  Action,
  useActionHandler,
  useAsyncAction,
} from "@rx-controls/forms-react-core";
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
export function FieldAction({ node }: { node: FormStateNode }): Rendered {
  const { rc, rendered } = useReactive();
  const state = node.getState(rc);
  const def = state.definition;
  const action = isActionControl(def) ? def : undefined;

  // Hooks stay above the bail-out below. `def.type` is stable for a
  // node's lifetime, so the guard never actually flips — but keeping the
  // hooks unconditional is what makes that a fact about the data rather
  // than a rules-of-hooks landmine. (This is why `FieldAction` was split
  // out of `Field`'s `switch` in the first place.)
  const dispatch = useActionHandler();
  const onClick = useAsyncAction(
    node,
    dispatch,
    action?.actionId ?? "",
    action?.actionData,
    action?.disableType ?? undefined,
  );

  if (!action) return rendered(null);

  const actionChildren = node.getChildren(rc);
  const renderedChildren =
    actionChildren.length > 0 ? (
      <>
        {actionChildren.map((c) => (
          <Field key={c.uniqueId} node={c} />
        ))}
      </>
    ) : undefined;

  return rendered(
    <Action
      actionId={action.actionId}
      actionText={action.title ?? undefined}
      onClick={onClick}
      disabled={state.disabled}
      busy={state.busy}
      icon={action.icon}
      actionStyle={action.actionStyle}
      iconPlacement={action.iconPlacement}
      disableType={action.disableType}
      styleClass={action.styleClass}
      textClass={action.textClass}
    >
      {renderedChildren}
    </Action>
  );
}
