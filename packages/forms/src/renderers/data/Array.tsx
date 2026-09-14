"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import { Field } from "../../Field";
import type { DataRendererProps } from "@rx-controls/forms-react-core";
import { Action, rendererClass, useArrayActions } from "@rx-controls/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Renders a list of array elements (one per child) plus Add / per-row
 * Edit / per-row Remove buttons.
 *
 * All logic — length constraints, action ids/text, dispatch-with-fallback,
 * and the editExternal flow — lives in {@link useArrayActions}. This view
 * only draws: each button is dispatched as plain `ActionRendererProps`
 * through `<Action>` so the host's registry decides the chrome (default
 * `ButtonAction`, or a per-id override via `matchActionId`). No
 * `FormStateNode` is synthesized for the inline buttons, mirroring the
 * legacy `@react-typed-forms/schemas-html` `DefaultArrayRenderer`.
 *
 * **editExternal**: the per-row Edit button only appears when the
 * controller reports it (`renderOptions.editExternal`). The modal that
 * displays the staged draft is rendered by a sibling `renderType:
 * ArrayElement` control bound to the same array field — see
 * `ArrayElementModalHostRenderer`. `ArrayRenderer` does not self-host it.
 */
export function ArrayRenderer({ node }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useArrayActions(rc, node);
  const arrayTheme = useHtmlTheme().data.array;
  if (!c.data) return rendered(null);
  const wrapperClass = rendererClass(c.styleClass, arrayTheme.className);

  return rendered(
    <div className={wrapperClass}>
      {c.children.map((child, i) => {
        const row = c.rowActions[i];
        return (
          <div key={child.uniqueId} className={arrayTheme.childClass}>
            <div className="flex-1">
              <Field node={child} />
            </div>
            {row.edit ? <Action {...row.edit} /> : null}
            <Action {...row.remove} />
          </div>
        );
      })}
      {c.addAction && <Action {...c.addAction} />}
    </div>
  );
}
