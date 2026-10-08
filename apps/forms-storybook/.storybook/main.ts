import type { StorybookConfig } from "@storybook/react-vite";
import { nativeWeb } from "../native-web";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  core: { disableTelemetry: true },
  // forms-native, drawn through react-native-web.
  viteFinal: (c) => ({
    ...c,
    resolve: { ...c.resolve, alias: { ...(c.resolve?.alias as object), ...nativeWeb } },
  }),
};

export default config;
