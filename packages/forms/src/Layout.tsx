"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LayoutComponent, LayoutProps } from "./types";

export function DefaultLayout({
  label,
  children,
  error,
  inline,
  className,
  style,
}: LayoutProps) {
  if (inline) {
    return (
      <span className={className} style={style}>
        {label && <>{label} </>}
        {children}
        {error && <> {error}</>}
      </span>
    );
  }
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`} style={style}>
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
