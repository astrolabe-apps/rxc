"use client";

import { createContext, useContext, type ReactNode } from "react";

const DesignModeContext = createContext<boolean>(false);

/**
 * Wrap a subtree (typically the editor's preview region) to mark it as
 * being in design mode. Renderers and adornments call `useDesignMode()`
 * to read this without explicit prop threading.
 */
export function DesignModeProvider({
  value,
  children,
}: {
  value: boolean;
  children: ReactNode;
}) {
  return (
    <DesignModeContext.Provider value={value}>
      {children}
    </DesignModeContext.Provider>
  );
}

export function useDesignMode(): boolean {
  return useContext(DesignModeContext);
}

export { DesignModeContext };
