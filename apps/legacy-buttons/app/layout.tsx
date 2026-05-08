import type { Metadata } from "next";
import type { ReactNode, JSX } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legacy ButtonAction Demo",
  description: "Side-by-side comparator for @react-typed-forms/schemas-html",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
