"use client";

import type { ReactNode } from "react";
import {
  ControlContextProvider,
  getCompatContext,
} from "@react-typed-forms/core";
import "./globals.css";

/**
 * The one line a legacy app adds for `@react-typed-forms/core@5`. Its own
 * component, for the two reasons `packages/compat-controls/README.md` gives:
 * hooks in the component that renders the provider run above it, and the SWC
 * controls plugin injects `useComponentTracking()` into every component it
 * transforms — including this one, unless told not to.
 */
/** @noTrackControls */
function CompatProvider({ children }: { children: ReactNode }) {
  return (
    <ControlContextProvider value={getCompatContext()}>
      {children}
    </ControlContextProvider>
  );
}

/** @noTrackControls */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CompatProvider>{children}</CompatProvider>
      </body>
    </html>
  );
}
