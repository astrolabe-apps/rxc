"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { VisibilityComponent, VisibilityProps } from "./types";

export function DefaultVisibility({ visible, children }: VisibilityProps) {
  return visible === true ? <>{children}</> : null;
}

const VisibilityCtx = createContext<VisibilityComponent>(DefaultVisibility);

export function VisibilityProvider({
  value,
  children,
}: {
  value: VisibilityComponent;
  children: ReactNode;
}) {
  return (
    <VisibilityCtx.Provider value={value}>{children}</VisibilityCtx.Provider>
  );
}

export function useVisibility(): VisibilityComponent {
  return useContext(VisibilityCtx);
}
