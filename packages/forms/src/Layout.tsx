"use client";

import { createContext, useContext, type ReactNode } from "react";
import { controls } from "@rxc/controls";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";
import type { LayoutComponent, LayoutProps } from "./types";

export const DefaultLayout = controls<LayoutProps>(
  "DefaultLayout",
  ({ node, label, children, error, inline, className, style }, { rc }) => {
    const def = node.getState(rc).definition;
    const theme = useHtmlTheme().layout ?? {};
    // Per-control class on the form definition; theme class from
    // HtmlFormOptions; `className` prop wins as the immediate caller's
    // request and is merged outside the rendererClass override gate.
    const merged = rendererClass(
      def.layoutClass,
      theme.className ?? (inline ? undefined : "flex flex-col gap-1"),
    );
    const finalClass = [merged, className].filter(Boolean).join(" ") || undefined;
    if (inline) {
      return (
        <span className={finalClass} style={style}>
          {label && <>{label} </>}
          {children}
          {error && <> {error}</>}
        </span>
      );
    }
    return (
      <div className={finalClass} style={style}>
        {label}
        {children}
        {error}
      </div>
    );
  },
);

const LayoutCtx = createContext<LayoutComponent>(DefaultLayout);

export function LayoutProvider({
  value,
  children,
}: {
  value: LayoutComponent;
  children: ReactNode;
}) {
  return <LayoutCtx.Provider value={value}>{children}</LayoutCtx.Provider>;
}

export function useLayout(): LayoutComponent {
  return useContext(LayoutCtx);
}
