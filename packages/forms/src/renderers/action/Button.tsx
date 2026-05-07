"use client";

import { controls } from "@rxc/controls";
import {
  ActionStyle,
  IconPlacement,
  isActionControl,
} from "@rxc/forms-core";
import type { ActionRendererProps } from "@rxc/forms-react-core";
import {
  rendererClass,
  useActionHandler,
  useAsyncAction,
} from "@rxc/forms-react-core";
import { iconClassFor } from "../display/Icon";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_PRIMARY =
  "px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-40";
const DEFAULT_SECONDARY =
  "px-3 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-sm disabled:opacity-40";
const DEFAULT_LINK = "text-blue-600 hover:underline disabled:opacity-40";

export const ButtonAction = controls<ActionRendererProps>(
  "ButtonAction",
  ({ node }, { rc }) => {
    const { definition, disabled, busy } = node.getState(rc);
    const actionTheme = useHtmlTheme().action ?? {};
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

    const baseClass =
      definition.actionStyle === ActionStyle.Link
        ? actionTheme.linkClass ?? DEFAULT_LINK
        : definition.actionStyle === ActionStyle.Secondary
          ? actionTheme.secondaryClass ?? DEFAULT_SECONDARY
          : actionTheme.primaryClass ?? DEFAULT_PRIMARY;
    const cls = rendererClass(definition.styleClass, baseClass);

    const beforeIconClass = actionTheme.iconBeforeClass ?? "mr-1";
    const afterIconClass = actionTheme.iconAfterClass ?? "ml-1";

    let body: React.ReactNode;
    if (placement === IconPlacement.ReplaceText) {
      body = icon;
    } else if (placement === IconPlacement.AfterText) {
      body = (
        <>
          <span>{text}</span>
          {icon && <span className={afterIconClass}>{icon}</span>}
        </>
      );
    } else {
      body = (
        <>
          {icon && <span className={beforeIconClass}>{icon}</span>}
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
