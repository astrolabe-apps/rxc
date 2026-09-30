import type { Preview } from "@storybook/react-vite";
import { implementations, StoryRoot, themes, type ScopeArgs } from "../src/support";
import "../src/tailwind.css";
import "../src/widgets.css";

/**
 * Every story runs inside the decorator: a fresh control context, the chosen
 * implementation and theme, and a `<Form>` carrying the scope args — so
 * presence, the two locks and design mode are a control on every story rather
 * than something each one wires up.
 */
const preview: Preview = {
  globalTypes: {
    implementation: {
      description: "The implementation every boundary draws with",
      toolbar: {
        title: "Implementation",
        icon: "component",
        items: Object.keys(implementations),
        dynamicTitle: true,
      },
    },
    theme: {
      description: "The html implementation's theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: Object.keys(themes),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { implementation: "html", theme: "default" },
  args: {
    presence: "rendered",
    disabled: false,
    readOnly: false,
    designMode: false,
    clearHidden: false,
  } satisfies ScopeArgs,
  argTypes: {
    presence: {
      control: "inline-radio",
      options: ["rendered", "silent", "hidden"],
      table: { category: "Form scope" },
    },
    disabled: { control: "boolean", table: { category: "Form scope" } },
    readOnly: { control: "boolean", table: { category: "Form scope" } },
    designMode: { control: "boolean", table: { category: "Form scope" } },
    clearHidden: { control: "boolean", table: { category: "Form scope" } },
  },
  decorators: [
    (Story, { args, globals }) => (
      <StoryRoot
        implementation={globals.implementation}
        theme={globals.theme}
        scope={args as ScopeArgs}
      >
        <Story />
      </StoryRoot>
    ),
  ],
};

export default preview;
