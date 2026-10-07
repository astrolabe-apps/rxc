import { act } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, Input, webLightTheme } from "@fluentui/react-components";

// Fluent logs "Keyborg instance kN is being disposed incorrectly" (dev only)
// when a provider that hosted a Dialog unmounts with no other focus-tracking
// instance alive in the window — which an app's long-lived provider never
// does, and a test does every time. Whether it fired would hang on story
// order; an `Input` rendered once leaves Fluent's window-level instance alive,
// as an app does. Same as `packages/forms-fluent/test/setup.tsx`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const root = createRoot(document.createElement("div"));
act(() =>
  root.render(
    <FluentProvider theme={webLightTheme}>
      <Input />
    </FluentProvider>,
  ),
);
act(() => root.unmount());
