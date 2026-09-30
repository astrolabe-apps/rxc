// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { SsrApp } from "./fixtures/kitchen";

/**
 * Server rendering with no DOM at all: no `window`, no `document`. Anything
 * that touches them during render, or warns on the server, fails here.
 */
afterEach(() => vi.restoreAllMocks());

describe("server rendering", () => {
  it("renders every renderer with no DOM and nothing on the console", () => {
    expect(typeof document).toBe("undefined");
    const logged: string[] = [];
    for (const level of ["error", "warn"] as const)
      vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
        logged.push(a.map(String).join(" "));
      });
    const html = renderToString(
      <StrictMode>
        <SsrApp />
      </StrictMode>,
    );
    expect(logged).toEqual([]);
    for (const s of ["Name", "Status (radios)", "Pet 2", "Tab A", "Page 1", "<dialog", "<em>markup</em>"])
      expect(html).toContain(s);
    // Silent content is in the markup, hidden: a closed dialog's field, an
    // inactive tab's, an unreached page.
    expect(html).toContain("Name in dialog");
    expect(html).toContain("Page 2");
  });
});
