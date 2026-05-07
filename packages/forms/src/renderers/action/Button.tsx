"use client";

import type { MouseEvent, ReactNode } from "react";
import { controls } from "@rxc/controls";
import {
  ActionStyle,
  ControlDisableType,
  IconPlacement,
  isActionControl,
} from "@rxc/forms-core";
import type { ActionRendererProps } from "@rxc/forms-react-core";
import {
  rendererClass,
  useActionHandler,
  useAsyncAction,
} from "@rxc/forms-react-core";
import { resolveIcon } from "../display/Icon";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_BUTTON = "px-3 py-1 rounded text-sm disabled:opacity-40";
const DEFAULT_PRIMARY = "bg-blue-600 text-white";
const DEFAULT_SECONDARY = "border border-zinc-300 dark:border-zinc-600";
const DEFAULT_LINK = "text-blue-600 hover:underline disabled:opacity-40";

export const ButtonAction = controls<ActionRendererProps>(
  "ButtonAction",
  ({ node }, { rc }) => {
    const { definition, disabled, busy } = node.getState(rc);
    const actionTheme = useHtmlTheme().action ?? {};
    if (!isActionControl(definition)) return null;
    const dispatch = useActionHandler();
    const runHandler = useAsyncAction(
      node,
      dispatch,
      definition.actionId,
      definition.actionData,
      definition.disableType ?? ControlDisableType.None,
    );

    const style = definition.actionStyle;
    const isLink = style === ActionStyle.Link;
    const isGroup = style === ActionStyle.Group;
    const isSecondary = style === ActionStyle.Secondary;

    // Variant chrome — legacy:
    //   isLink  → linkClass
    //   isGroup → groupClass
    //   else    → rendererClass(buttonClass, primary/secondary)
    const variantClass = isLink
      ? actionTheme.linkClass ?? DEFAULT_LINK
      : isGroup
        ? actionTheme.groupClass
        : rendererClass(
            actionTheme.buttonClass ?? DEFAULT_BUTTON,
            isSecondary
              ? actionTheme.secondaryClass ?? DEFAULT_SECONDARY
              : actionTheme.primaryClass ?? DEFAULT_PRIMARY,
          );

    // Text class — legacy:
    //   rendererClass(definition.textClass,
    //     isLink ? linkTextClass
    //            : rendererClass(textClass, primary/secondaryTextClass))
    const variantTextClass = isLink
      ? actionTheme.linkTextClass
      : rendererClass(
          actionTheme.textClass,
          isSecondary
            ? actionTheme.secondaryTextClass
            : actionTheme.primaryTextClass,
        );
    const textClassNames = rendererClass(
      definition.textClass,
      variantTextClass,
    );

    // Container className — legacy DefaultHtmlButtonRenderer:
    //   nonTextContent (Group) → className alone
    //   else                   → clsx(className, textClass)
    const styledClass = rendererClass(definition.styleClass, variantClass);
    const containerClass = isGroup
      ? styledClass
      : rendererClass(styledClass, textClassNames);

    // Icon resolution — while busy, prefer the theme's busyIcon
    // (typically a spinner). Otherwise fall back to definition.icon →
    // theme.icon.
    const restingIcon = definition.icon ?? actionTheme.icon;
    const activeIcon = busy ? actionTheme.busyIcon ?? restingIcon : restingIcon;
    const restingPlacement =
      definition.iconPlacement ?? IconPlacement.BeforeText;
    const placement =
      busy && actionTheme.busyIcon
        ? definition.iconPlacement ??
          actionTheme.busyIconPlacement ??
          IconPlacement.ReplaceText
        : restingPlacement;

    const resolved = activeIcon ? resolveIcon(undefined, activeIcon) : null;
    const placementClass =
      placement === IconPlacement.BeforeText
        ? actionTheme.iconBeforeClass
        : placement === IconPlacement.AfterText
          ? actionTheme.iconAfterClass
          : undefined;
    // Legacy: iconElement className = rendererClass(textClassNames,
    // iconBefore/AfterClass) — text class is threaded into the icon span.
    const iconCls = rendererClass(
      resolved?.className,
      rendererClass(textClassNames, placementClass),
    );
    const iconNode: ReactNode = resolved ? (
      <i className={iconCls} aria-hidden>
        {resolved.text}
      </i>
    ) : null;

    const text = definition.title ?? definition.actionId;
    const textSpan: ReactNode = text ? (
      <span className={textClassNames}>{text}</span>
    ) : null;

    // Legacy three-slot conditional fragment.
    const body = (
      <>
        {placement === IconPlacement.BeforeText && iconNode}
        {placement !== IconPlacement.ReplaceText && textSpan}
        {placement !== IconPlacement.BeforeText && iconNode}
      </>
    );

    const titleAttr =
      placement === IconPlacement.ReplaceText && text ? text : undefined;
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      runHandler();
    };

    // Legacy: nonTextContent (Group) renders <div role="button">; else
    // <button>.
    if (isGroup) {
      const inert = disabled || busy;
      return (
        <div
          role="button"
          aria-disabled={inert ? true : undefined}
          title={titleAttr}
          onClick={inert ? undefined : onClick}
          className={containerClass}
        >
          {body}
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={disabled || busy}
        title={titleAttr}
        onClick={onClick}
        className={containerClass}
      >
        {body}
      </button>
    );
  },
);
