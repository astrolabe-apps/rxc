"use client";

import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/theme.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
