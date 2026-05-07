"use client";

import { controls } from "@rxc/controls";
import {
  ActionStyle,
  IconPlacement,
  isActionControl,
} from "@rxc/forms-core";
import type { ActionRendererProps } from "@rxc/forms-react-core";
import { useActionHandler } from "@rxc/forms-react-core";
import { useAsyncAction } from "@rxc/forms-react-core";
import { iconClassFor } from "../display/Icon";

export const ButtonAction = controls<ActionRendererProps>(
  "ButtonAction",
  ({ node }, { rc }) => {
    const { definition, disabled, busy } = node.getState(rc);
    if (!isActionControl(definition)) return null;
    const dispatch = useActionHandler();
    const handler = useAsyncAction(
      node,
      dispatch,
      definition.actionId,
      definition.actionData,
    );
    const iconCls = iconClassFor(undefined, definition.icon);
    const icon = iconCls ? <i className={iconCls} aria-hidden /> : null;
    const placement = definition.iconPlacement ?? IconPlacement.BeforeText;
    const text = busy ? "…" : (definition.title ?? definition.actionId);
    const cls =
      definition.actionStyle === ActionStyle.Link
        ? "text-blue-600 hover:underline disabled:opacity-40"
        : definition.actionStyle === ActionStyle.Secondary
          ? "px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-sm disabled:opacity-40"
          : "px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-40";

    let body: React.ReactNode;
    if (placement === IconPlacement.ReplaceText) {
      body = icon;
    } else if (placement === IconPlacement.AfterText) {
      body = (
        <>
          <span>{text}</span>
          {icon && <span className="ml-1">{icon}</span>}
        </>
      );
    } else {
      body = (
        <>
          {icon && <span className="mr-1">{icon}</span>}
          <span>{text}</span>
        </>
      );
    }

    return (
      <button
        type="button"
        disabled={disabled || busy}
        onClick={(e) => {
          e.stopPropagation();
          handler();
        }}
        className={cls}
      >
        {body}
      </button>
    );
  },
);
