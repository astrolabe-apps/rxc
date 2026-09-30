import type { ReactNode } from "react";
import "./servicetas.css";

/**
 * A root layout of its own: ServiceTas's page needs Bootstrap 3, the portal
 * `theme.css` and a Tailwind build with no preflight — the baseline
 * `apps/legacy-compare` renders legacy on — and the dev app's own root loads
 * full Tailwind with preflight for every other page. The baseline loads by
 * <link>, ahead of this layout's stylesheet, so the portal's source-order
 * overrides still hold; the files are `legacy-compare`'s, served by the
 * route handlers beside this layout (`assets.ts`).
 */
export default function ServiceTasLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://kit.fontawesome.com/95cc77b353.css" />
        <link rel="stylesheet" href="/servicetas/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/servicetas/css/theme.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
