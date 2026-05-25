"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import { controls } from "@rxc/controls";
import {
  isDataControl,
  isGroupControl,
  type FormStateNode,
} from "@rxc/forms-core";
import {
  indexAdornments,
  rendererClass,
  useRegistry,
  wrapAdornments,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";

export type LabelTag = "label" | "legend" | "span" | "div";

export interface LabelProps {
  node: FormStateNode;
  /** Target input id when rendering as `<label>`. Ignored for tags that
   * don't accept `for` (e.g. `<legend>`). */
  htmlFor?: string;
  /** Element to render. Defaults to `"label"`. Radio / Checklist renderers
   * pass `"legend"` so the title sits inside their `<fieldset>` but still
   * picks up the same Label component, theme, and host overrides. */
  as?: LabelTag;
  /** DOM id for the rendered element. Field passes `${fieldId}-label` so
   * fieldset-using renderers can wire `aria-labelledby` at it. */
  id?: string;
  children: ReactNode;
}

export type LabelComponent = ComponentType<LabelProps>;

/**
 * True for definitions that the renderer set treats as group-shaped:
 *   - `type: "Group"` definitions
 *   - compound Data controls rendered via `renderOptions.type === "Group"`
 *
 * `<DefaultLabel>` uses this to layer `theme.label.groupClassName` on top
 * of the regular label class for group titles, replacing the legacy
 * `LabelType.Group` distinction.
 */
export function isGroupLabel(def: {
  type: string;
  renderOptions?: { type?: string } | null;
}): boolean {
  if (isGroupControl(def as any)) return true;
  if (
    isDataControl(def as any) &&
    (def.renderOptions as { type?: string } | null | undefined)?.type ===
      "Group"
  ) {
    return true;
  }
  return false;
}

export const DefaultLabel = controls<LabelProps>(
  "DefaultLabel",
  ({ node, htmlFor, as: tag, id, children }, { rc }) => {
    const def = node.getState(rc).definition;
    const required = isDataControl(def) && !!def.required;
    const theme = useHtmlTheme().label ?? {};
    // Merge text-class onto the label tag itself (matches legacy
    // `<label class="py-4 text-2xl title1">…` shape — one element, all
    // classes). Earlier the textClass was wrapped on an inner `<span>`,
    // which produced extra DOM and broke inheritance / specificity
    // assumptions that hosts (e.g. Bootstrap label rules) rely on.
    const textClassName = rendererClass(def.labelTextClass, theme.textClass);
    const labelClassName = rendererClass(
      def.labelClass,
      [
        theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
        isGroupLabel(def) ? theme.groupClassName : undefined,
        textClassName,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const Tag = tag ?? "label";
    const tagProps = {
      ...(Tag === "label" && htmlFor ? { htmlFor } : {}),
      ...(id ? { id } : {}),
    };
    const labelEl = (
      <Tag {...tagProps} className={labelClassName}>
        {children}
        {required && (
          <span
            aria-hidden
            className={theme.requiredClass ?? "text-red-400 ml-0.5"}
          >
            {theme.requiredText ?? "*"}
          </span>
        )}
      </Tag>
    );
    // Compose label-kind adornments here so any caller that renders
    // a <Label> (Field by default, or renderers like Bool/Radio that
    // want their own inline label) automatically picks up HelpText /
    // Icon / etc. adornments. When no <Label> is rendered, no
    // adornment fires — which is the correct behavior for
    // `hidesLabel` renderers that intentionally omit a label slot.
    const adornments = def.adornments ?? [];
    const registry = useRegistry();
    const adornmentMap = useMemo(
      () => indexAdornments(registry.adornments),
      [registry.adornments],
    );
    return wrapAdornments(adornments, adornmentMap, "label", labelEl, node);
  },
);

const LabelCtx = createContext<LabelComponent>(DefaultLabel);

export function LabelProvider({
  value,
  children,
}: {
  value: LabelComponent;
  children: ReactNode;
}) {
  return <LabelCtx.Provider value={value}>{children}</LabelCtx.Provider>;
}

export function useLabel(): LabelComponent {
  return useContext(LabelCtx);
}
