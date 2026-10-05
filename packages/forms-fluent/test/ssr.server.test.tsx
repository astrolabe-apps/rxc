// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode, type ReactElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { createDOMRenderer, renderToStyleElements } from "@fluentui/react-components";
import { SsrApp } from "./fixtures/kitchen";

/**
 * Server rendering with no DOM at all: no `window`, no `document`. Anything
 * that touches them during render, or warns on the server, fails here.
 */
afterEach(() => vi.restoreAllMocks());

function render(app: ReactElement) {
  expect(typeof document).toBe("undefined");
  const logged: string[] = [];
  for (const level of ["error", "warn"] as const)
    vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
      logged.push(a.map(String).join(" "));
    });
  const html = renderToString(<StrictMode>{app}</StrictMode>);
  expect(logged).toEqual([]);
  for (const s of ["Name", "Status (radios)", "Pet 2", "Tab A", "Page 1", "<em>markup</em>"])
    expect(html).toContain(s);
  // Silent content is in the markup, hidden: an inactive tab's, an
  // unreached page's.
  expect(html).toContain("Page 2");
  return html;
}

describe("server rendering", () => {
  it("renders every renderer with no DOM and nothing on the console, supplying its own provider", () => {
    const html = render(<SsrApp />);
    expect(html).toContain("fui-FluentProvider");
  });

  it("renders inside a Fluent app's server setup, and the CSS comes out with it", () => {
    const renderer = createDOMRenderer();
    const html = render(<SsrApp renderer={renderer} />);
    // The app's provider only: the root added none of its own.
    expect(html.match(/fui-FluentProvider\b/g)).toHaveLength(1);
    // What a Fluent app puts in <head>: the atomic CSS the form used,
    // collected while it rendered — Fluent's own and the implementation's.
    const css = renderToStaticMarkup(<>{renderToStyleElements(renderer)}</>);
    expect(css).toContain("<style");
    expect(css.length).toBeGreaterThan(1000);
  });

  it("leaves a closed dialog's content out of the markup — Fluent portals render on the client", () => {
    // Recorded rather than wanted: the content mounts, and starts validating,
    // once the client hydrates. The server cannot judge a closed dialog's
    // fields, which no SSR form submits before hydration anyway.
    const html = render(<SsrApp />);
    expect(html).not.toContain("Name in dialog");
  });
});
