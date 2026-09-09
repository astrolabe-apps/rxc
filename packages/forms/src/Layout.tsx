"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useReactive, type Rendered } from "@rxc/controls";
import { clsx, rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "./useHtmlTheme";
import type { LayoutComponent, LayoutProps } from "./types";

export function DefaultLayout({ node, label, children, error, inline, className, style }: LayoutProps): Rendered {
  const { rc, rendered } = useReactive();
  const def = node.getState(rc).definition;
  const theme = useHtmlTheme().layout;
  // Per-control class on the form definition; theme class from
  // HtmlFormOptions; `className` prop wins as the immediate caller's
  // request and is merged outside the rendererClass override gate.
  const merged = rendererClass(def.layoutClass, theme.className);
  const finalClass = clsx(merged, className);
  if (inline) {
    return rendered(
      <span className={finalClass} style={style}>
        {label && <>{label} </>}
        {children}
        {error && <> {error}</>}
      </span>
    );
  }
  return rendered(
    <div className={finalClass} style={style}>
      {label}
      {children}
      {error}
    </div>
  );
}

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
