import { afterEach, describe, expect, it, vi } from "vitest";
import { act, StrictMode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { SsrApp } from "./fixtures/kitchen";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * Server HTML, hydrated by a fresh client: the markup has to agree to the
 * attribute — generated ids, hidden regions, closed dialogs, the theme's
 * classes — and the form has to be live afterwards.
 */
afterEach(() => vi.restoreAllMocks());

describe("hydration", () => {
  it("hydrates the server's markup with no mismatch, keeps its nodes, and is live after", () => {
    const app = (
      <StrictMode>
        <SsrApp />
      </StrictMode>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
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
      root = hydrateRoot(container, app, {
        onRecoverableError: (e) => recoverable.push(e),
      });
    });
    expect(recoverable).toEqual([]);
    expect(logged).toEqual([]);
    // Hydrated in place: the server's node is the client's.
    expect(container.querySelector("input")).toBe(serverInput);

    // Live: typing reaches the control, which every field bound to it shows.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(serverInput, "Grace");
      serverInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("Grace");
    act(() => root.unmount());
    container.remove();
  });
});
