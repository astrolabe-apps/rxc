import { act, StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import * as preview from "../.storybook/preview";
import { implementations, themes } from "../src/support";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

setProjectAnnotations(preview);

/**
 * Every story, rendered under every implementation (and html under every
 * theme) and under StrictMode, fails on any console error or warning — the rule `rush test` already enforces through stderr, applied to
 * the stories so a render-phase warning cannot sit in one unnoticed.
 */
const modules = import.meta.glob<Record<string, unknown>>(
  "../src/**/*.stories.tsx",
  { eager: true },
);

/**
 * Every implementation, and html under each of its themes — the theme global
 * means nothing to the others.
 */
const variants = Object.keys(implementations).flatMap((implementation) =>
  implementation === "html"
    ? Object.keys(themes).map((theme) => ({
        implementation,
        theme,
        label: `html · ${theme}`,
      }))
    : [{ implementation, theme: "default", label: implementation }],
);

let messages: string[];
beforeEach(() => {
  messages = [];
  for (const level of ["error", "warn"] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      messages.push(`console.${level}: ${args.map(String).join(" ")}`);
    });
});
afterEach(() => vi.restoreAllMocks());

for (const [path, mod] of Object.entries(modules)) {
  const story = mod as Parameters<typeof composeStories>[0];
  describe(path.replace("../src/", ""), () => {
    for (const { implementation, theme, label } of variants) {
      // Globals are project-level, so each variant is its own composition.
      const stories = composeStories(story, {
        initialGlobals: { implementation, theme },
      });
      for (const [name, composed] of Object.entries(stories)) {
        const Story = composed as ComponentType;
        it(`${name} (${label})`, async () => {
          const container = document.createElement("div");
          document.body.appendChild(container);
          const root = createRoot(container);
          await act(async () =>
            root.render(
              <StrictMode>
                <Story />
              </StrictMode>,
            ),
          );
          expect(container.innerHTML).not.toBe("");
          await act(async () => root.unmount());
          container.remove();
          expect(messages).toEqual([]);
        });
      }
    }
  });
}
