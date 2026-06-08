"use client";

import type { ReactNode } from "react";
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
      definition.disableType ?? ControlDisableType.None,
    );

    const style = definition.actionStyle;
    const isLink = style === ActionStyle.Link;
    const isGroup = style === ActionStyle.Group;
    const isSecondary = style === ActionStyle.Secondary;

    const variantClass = isLink
      ? actionTheme.linkClass
      : isGroup
        ? actionTheme.groupClass
        : isSecondary
          ? actionTheme.secondaryClass
          : actionTheme.primaryClass;
    // Link/Group don't carry the base button padding/rounding.
    const baseButton = isLink || isGroup ? null : actionTheme.buttonClass;
    // Layout class (default `inline-flex …` so icon + text compose); hosts
    // wanting plain inline markup (legacy parity) set `*LayoutClass: ""`.
    const layout = isLink
      ? actionTheme.linkLayoutClass
      : isGroup
        ? null
        : actionTheme.buttonLayoutClass;
    const cls = rendererClass(
      definition.styleClass,
      rendererClass(layout, rendererClass(baseButton, variantClass)),
    );

    const variantTextClass = isLink
      ? actionTheme.linkTextClass
      : isSecondary
        ? actionTheme.secondaryTextClass
        : actionTheme.primaryTextClass;
    const textCls = rendererClass(
      definition.textClass,
      rendererClass(actionTheme.textClass, variantTextClass),
    );

    // Icon resolution: while busy, prefer the theme's busy icon (typical
    // spinner). Otherwise fall back to definition.icon → theme.icon.
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
    // Form definitions sometimes carry `icon: {}` on actions that
    // shouldn't render an icon (legacy parity — Cancel/Next button
    // pairs where only Next has an icon). `resolveIcon` returns
    // `{ className: "" }` for that; treat it as no-icon here so we
    // don't emit an empty `<i>`.
    const hasResolvedIcon = !!(resolved && (resolved.className || resolved.text));
    const iconCls = rendererClass(
      resolved?.className,
      placement === IconPlacement.AfterText
        ? actionTheme.iconAfterClass
        : placement === IconPlacement.BeforeText
          ? actionTheme.iconBeforeClass
          : undefined,
    );
    const iconNode: ReactNode = hasResolvedIcon ? (
      <i className={iconCls} aria-hidden>
        {resolved!.text}
      </i>
    ) : null;

    const text = definition.title ?? definition.actionId;
    const textNode: ReactNode = text ? (
      <span className={textCls}>{text}</span>
    ) : null;

    let body: ReactNode;
    if (placement === IconPlacement.ReplaceText) {
      // Spinner-only / icon-only button — fall back to text if the
      // active icon couldn't be resolved (e.g. busy with no busyIcon
      // configured) so the button isn't empty.
      body = iconNode ?? textNode;
    } else if (placement === IconPlacement.AfterText) {
      body = (
        <>
          {textNode}
          {iconNode}
        </>
      );
    } else {
      body = (
        <>
          {iconNode}
          {textNode}
        </>
      );
    }

    return (
      <button
        type="button"
        disabled={disabled || busy}
        title={
          placement === IconPlacement.ReplaceText && text ? text : undefined
        }
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
