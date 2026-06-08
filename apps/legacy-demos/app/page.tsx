"use client";

import type { ReactElement } from "react";

const NAV_LINKS: { href: string; label: string; description: string }[] = [
  {
    href: "/buttons",
    label: "/buttons",
    description:
      "ButtonAction renderer baseline via @react-typed-forms/schemas-html — pair with localhost:3000/buttons in the dev app.",
  },
  {
    href: "/externaledit",
    label: "/externaledit",
    description:
      "Staged-edit modal (ArrayRenderOptions.editExternal) baseline — pair with localhost:3000/externaledit in the dev app.",
  },
];

export default function Home(): ReactElement {
  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      <main className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-zinc-900">Legacy demos</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Reference renderings using the published{" "}
          <code>@react-typed-forms/schemas</code> +{" "}
          <code>@react-typed-forms/schemas-html</code>. Each page mirrors a
          demo in the new <code>apps/dev</code> playground so the same
          form content can be inspected side by side.
        </p>
        <nav className="mt-6 border-t border-zinc-200 pt-4">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Pages</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-blue-600 hover:underline"
                >
                  {l.label}
                </a>
                <span className="text-zinc-500">
                  {" — "}
                  {l.description}
                </span>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}
