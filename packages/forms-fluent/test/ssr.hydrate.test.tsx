import { afterEach, describe, expect, it, vi } from "vitest";
import { act, StrictMode, type ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { createDOMRenderer } from "@fluentui/react-components";
import { Provider_unstable as FluentContext } from "@fluentui/react-shared-contexts";
import { SsrApp } from "./fixtures/kitchen";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * Server HTML, hydrated by a fresh client: the markup has to agree to the
 * attribute — generated ids, hidden regions, Fluent's classes — and the form
 * has to be live afterwards, its closed dialog's content mounted.
 */
afterEach(() => vi.restoreAllMocks());

// happy-dom 15.11 answers `undefined` for a <select>'s `nextSibling` (fixed by
// 20), and hydration walks siblings: Fluent's `Select` draws its chevron
// after the <select>, so React reported it missing and regenerated the tree.
// Remove with the repo's move off happy-dom 15. (happy-dom wraps a <select>
// in a Proxy, so `this` here is not the node in `childNodes`: it is found by
// a mark set through `this`, which reads through the Proxy.)
const mark = Symbol("select");
Object.defineProperty(HTMLSelectElement.prototype, "nextSibling", {
  configurable: true,
  get(this: HTMLSelectElement & { [mark]?: boolean }) {
    const siblings = [...(this.parentNode?.childNodes ?? [])] as (Node & { [mark]?: boolean })[];
    this[mark] = true;
    try {
      const i = siblings.findIndex((n) => n[mark]);
      return i < 0 ? null : (siblings[i + 1] ?? null);
    } finally {
      delete this[mark];
    }
  },
});

/**
 * The server's render, as a server sees it. With no `window` or `document`
 * during the render — and with no `document` in Fluent's context, which it
 * captured when its modules loaded (the default `targetDocument`) and makes a
 * portal's mount node from. A server's module graph loads with none; this
 * one loaded under happy-dom, and would portal a closed dialog, which React's
 * server renderer throws on.
 */
function serverRender(app: ReactElement): string {
  const g = globalThis as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };
  const set = (v: (k: "window" | "document") => unknown) => {
    for (const k of ["window", "document"] as const)
      Object.defineProperty(g, k, { value: v(k), configurable: true, writable: true });
  };
  set(() => undefined);
  try {
    return renderToString(
      <StrictMode>
        <FluentContext value={{ targetDocument: undefined, dir: "ltr" }}>{app}</FluentContext>
      </StrictMode>,
    );
  } finally {
    set((k) => saved[k]);
  }
}

function hydrate(server: () => ReactElement, client: ReactElement) {
  const html = serverRender(server());
  // The server could not portal the closed dialog: its content is not here.
  expect(html).not.toContain("Name in dialog");
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const serverInput = container.querySelector("input")!;

  const logged: string[] = [];
  for (const level of ["error", "warn"] as const)
    vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
      logged.push(a.map(String).join(" "));
    });
  const recoverable: unknown[] = [];
  let root!: Root;
  act(() => {
    root = hydrateRoot(container, <StrictMode>{client}</StrictMode>, {
      onRecoverableError: (e) => recoverable.push(e),
    });
  });
  expect(recoverable).toEqual([]);
  expect(logged).toEqual([]);
  // Hydrated in place: the server's node is the client's.
  expect(container.querySelector("input")).toBe(serverInput);
  // The closed dialog's content is mounted now — out of reach, but there to
  // validate.
  const inDialog = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === "Name in dialog",
  );
  expect(inDialog).toBeDefined();
  expect(inDialog!.closest("[inert]")).not.toBeNull();

  // Live: typing reaches the control, which every field bound to it shows.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(serverInput, "Grace");
    serverInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("Grace");
  act(() => root.unmount());
  container.remove();
}

describe("hydration", () => {
  it("hydrates the server's markup with no mismatch, keeps its nodes, and is live after", () => {
    hydrate(() => <SsrApp />, <SsrApp />);
  });

  it("does the same inside a Fluent app's server setup", () => {
    // Each side's renderer its own, as in an app: the server's collects the
    // CSS for <head>, the client's inserts it live.
    hydrate(
      () => <SsrApp renderer={createDOMRenderer()} />,
      <SsrApp renderer={createDOMRenderer(document)} />,
    );
  });
});
