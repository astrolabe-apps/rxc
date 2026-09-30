import { act, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import * as preview from "../.storybook/preview";
import { themes } from "../src/support";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

setProjectAnnotations(preview);

/**
 * Every story, rendered under every theme, fails on any console error or
 * warning — the rule `rush test` already enforces through stderr, applied to
 * the stories so a render-phase warning cannot sit in one unnoticed.
 */
const modules = import.meta.glob<Record<string, unknown>>(
  "../src/**/*.stories.tsx",
  { eager: true },
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
    for (const theme of Object.keys(themes)) {
      // Globals are project-level, so each theme is its own composition.
      const stories = composeStories(story, {
        initialGlobals: { implementation: "html", theme },
      });
      for (const [name, composed] of Object.entries(stories)) {
        const Story = composed as ComponentType;
        it(`${name} (${theme})`, async () => {
          const container = document.createElement("div");
          document.body.appendChild(container);
          const root = createRoot(container);
          await act(async () =>
            root.render(<Story />),
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
