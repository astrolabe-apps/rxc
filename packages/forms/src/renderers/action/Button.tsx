"use client";

import type { ReactNode } from "react";
import { ActionStyle, IconPlacement } from "@rxc/forms-core";
import type { ActionRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { resolveIcon } from "../display/Icon";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Default action renderer — draws a `<button>` from plain
 * {@link ActionRendererProps} (no `FormStateNode` involved).
 *
 * For form-tree action controls, `<Field>` adapts the
 * `FormStateNode` to these props and wires `onClick` through
 * `useActionHandler` + `useAsyncAction` (so the button picks up
 * busy/disabled state from the node and dispatches through the
 * `<ActionScope>` chain). For inline actions (e.g. an Array
 * renderer's Add / Edit / Remove buttons), the caller builds the
 * props directly with their own `onClick`.
 *
 * Hosts can register a custom action renderer per id via
 * `matchActionId(id, MyRenderer)` to fully own the visual chrome;
 * `MyRenderer` just invokes `props.onClick` to inherit the default
 * dispatch behavior.
 */
export function ButtonAction({
  actionId,
  actionText,
  onClick,
  disabled,
  busy,
  icon,
  actionStyle,
  iconPlacement,
  styleClass,
  textClass,
  children,
}: ActionRendererProps) {
  const actionTheme = useHtmlTheme().action ?? {};

  const style = actionStyle ?? undefined;
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
  const baseButton = isLink || isGroup ? null : actionTheme.buttonClass;
  const layout = isLink
    ? actionTheme.linkLayoutClass
    : isGroup
      ? null
      : actionTheme.buttonLayoutClass;
  const cls = rendererClass(
    styleClass ?? undefined,
    rendererClass(layout, rendererClass(baseButton, variantClass)),
  );

  const variantTextClass = isLink
    ? actionTheme.linkTextClass
    : isSecondary
      ? actionTheme.secondaryTextClass
      : actionTheme.primaryTextClass;
  const textCls = rendererClass(
    textClass ?? undefined,
    rendererClass(actionTheme.textClass, variantTextClass),
  );

  // Icon resolution: while busy, prefer the theme's busy icon (typical
  // spinner). Otherwise fall back to definition.icon → theme.icon.
  const restingIcon = icon ?? actionTheme.icon;
  const activeIcon = busy ? actionTheme.busyIcon ?? restingIcon : restingIcon;
  const restingPlacement = iconPlacement ?? IconPlacement.BeforeText;
  const placement =
    busy && actionTheme.busyIcon
      ? iconPlacement ??
        actionTheme.busyIconPlacement ??
        IconPlacement.ReplaceText
      : restingPlacement;

  const resolved = activeIcon ? resolveIcon(undefined, activeIcon) : null;
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

  const text = actionText ?? actionId;
  const textNode: ReactNode = text ? (
    <span className={textCls}>{text}</span>
  ) : null;

  // If the action def supplies `children` (rendered nested form
  // content — Display controls, custom markup, anything that becomes
  // the *body* of the clickable element), use that as the button's
  // content. Otherwise compose the default icon + text per
  // `iconPlacement`. Mirrors the legacy `appendMarkup` flow where
  // child markup overrode the auto-composed body.
  let body: ReactNode;
  if (children !== undefined) {
    body = children;
  } else if (placement === IconPlacement.ReplaceText) {
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
        onClick();
      }}
      className={cls}
    >
      {body}
    </button>
  );
}

// Preserve the displayName the matcher tests assert against.
ButtonAction.displayName = "ButtonAction";
