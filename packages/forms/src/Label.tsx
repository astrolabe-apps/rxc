"use client";

import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import { controls } from "@rxc/controls";
import {
  isDataControl,
  isGroupControl,
  type FormStateNode,
} from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";

export interface LabelProps {
  node: FormStateNode;
  htmlFor: string;
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
  ({ node, htmlFor, children }, { rc }) => {
    const def = node.getState(rc).definition;
    const required = isDataControl(def) && !!def.required;
    const theme = useHtmlTheme().label ?? {};
    const labelClassName = rendererClass(
      def.labelClass,
      [
        theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
        isGroupLabel(def) ? theme.groupClassName : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const textClassName = rendererClass(def.labelTextClass, theme.textClass);
    return (
      <label htmlFor={htmlFor} className={labelClassName}>
        {textClassName ? (
          <span className={textClassName}>{children}</span>
        ) : (
          children
        )}
        {required && (
          <span
            aria-hidden
            className={theme.requiredClass ?? "text-red-400 ml-0.5"}
          >
            *
          </span>
        )}
      </label>
    );
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
