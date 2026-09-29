import { describe, expect, it } from "vitest";
import {
  defaultHtmlTheme,
  HtmlThemeProvider,
  tailwindHtmlTheme,
  useHtmlTheme,
  type HtmlTheme,
  type PartialHtmlTheme,
} from "../src/index";
import { setupDom } from "./harness";

const dom = setupDom();

describe("HtmlThemeProvider", () => {
  let seen: HtmlTheme[] = [];
  function Probe() {
    seen.push(useHtmlTheme());
    return null;
  }

  it("is the default theme with no provider", () => {
    seen = [];
    dom.mount(<Probe />);
    expect(seen.at(-1)).toBe(defaultHtmlTheme);
  });

  it("nests: each provider merges over the one above, slot by slot", () => {
    seen = [];
    const base: PartialHtmlTheme = { shell: { label: "base-label" } };
    const overlay: PartialHtmlTheme = { contents: { title: "overlay-title" } };
    dom.mount(
      <HtmlThemeProvider theme={base}>
        <HtmlThemeProvider theme={overlay}>
          <Probe />
        </HtmlThemeProvider>
      </HtmlThemeProvider>,
    );
    const t = seen.at(-1)!;
    expect(t.shell.label).toBe("base-label");
    expect(t.contents.title).toBe("overlay-title");
    // Untouched slots come from the default.
    expect(t.shell.error).toBe(defaultHtmlTheme.shell.error);
  });

  it("replaces a slot rather than appending to it", () => {
    seen = [];
    dom.mount(
      <HtmlThemeProvider theme={{ shell: { label: "mine" } }}>
        <Probe />
      </HtmlThemeProvider>,
    );
    expect(seen.at(-1)!.shell.label).toBe("mine");
  });

  it("resolves once per theme object, not per render", () => {
    seen = [];
    const theme: PartialHtmlTheme = { shell: { label: "x" } };
    const ui = (
      <HtmlThemeProvider theme={theme}>
        <Probe />
      </HtmlThemeProvider>
    );
    dom.mount(ui);
    dom.mount(<HtmlThemeProvider theme={theme}><Probe /></HtmlThemeProvider>);
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it("replaces React-node and function slots whole", () => {
    seen = [];
    const busy = <b>busy</b>;
    const renderError = () => null;
    dom.mount(
      <HtmlThemeProvider theme={{ action: { busy }, shell: { renderError } }}>
        <Probe />
      </HtmlThemeProvider>,
    );
    expect(seen.at(-1)!.action.busy).toBe(busy);
    expect(seen.at(-1)!.shell.renderError).toBe(renderError);
  });
});

/** Every `rxf-` hook in a slot of `a`, by slot path. */
function hooks(t: unknown, path = ""): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (typeof t === "string") {
    const hs = t.split(/\s+/).filter((c) => c.startsWith("rxf-"));
    if (hs.length) out.set(path, hs);
  } else if (t && typeof t === "object" && !("$$typeof" in t)) {
    for (const [k, v] of Object.entries(t))
      for (const [p, h] of hooks(v, path ? `${path}.${k}` : k)) out.set(p, h);
  }
  return out;
}

describe("the themes", () => {
  it("keep every hook class: tailwindHtmlTheme carries each of the default's in the same slot", () => {
    const tw = hooks(tailwindHtmlTheme);
    for (const [slot, hs] of hooks(defaultHtmlTheme)) {
      const got = tw.get(slot) ?? [];
      for (const h of hs) expect(got, `${slot} should carry ${h}`).toContain(h);
    }
  });

  it("has only rxf- hook classes in the default's class slots", () => {
    // String slots that are not classes.
    const notClasses = /(^|\.)(text|emptyText|classNameOn|hideWith)$/;
    const walk = (t: unknown, path: string): void => {
      if (typeof t === "string") {
        if (notClasses.test(path) || !t) return;
        for (const c of t.split(/\s+/))
          expect(c.startsWith("rxf-"), `${path}: ${c}`).toBe(true);
      } else if (t && typeof t === "object" && !("$$typeof" in t))
        for (const [k, v] of Object.entries(t)) walk(v, path ? `${path}.${k}` : k);
    };
    walk(defaultHtmlTheme, "");
  });

  it("hide a region by attribute in the default, and by class in the Tailwind theme", () => {
    expect(defaultHtmlTheme.contents.hideWith).toBe("attribute");
    expect(tailwindHtmlTheme.contents.hideWith).toBe("class");
  });
});
