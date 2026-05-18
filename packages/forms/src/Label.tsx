"use client";

import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import { controls } from "@rxc/controls";
import { isDataControl, type FormStateNode } from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";

export interface LabelProps {
  node: FormStateNode;
  htmlFor: string;
  children: ReactNode;
}

export type LabelComponent = ComponentType<LabelProps>;

export const DefaultLabel = controls<LabelProps>(
  "DefaultLabel",
  ({ node, htmlFor, children }, { rc }) => {
    const def = node.getState(rc).definition;
    const required = isDataControl(def) && !!def.required;
    const theme = useHtmlTheme().label ?? {};
    const labelClassName = rendererClass(
      def.labelClass,
      theme.className ?? "text-xs font-medium text-zinc-600 dark:text-zinc-400",
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

/** @deprecated Prefer `DefaultLabel` for the built-in implementation, or
 *  `useLabel()` to honor any `<LabelProvider>` override in scope. */
export const Label = DefaultLabel;

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
