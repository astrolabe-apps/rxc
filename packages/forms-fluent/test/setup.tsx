import { act } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, Input, webLightTheme } from "@fluentui/react-components";

// Fluent's focus tracking (Tabster's Keyborg) logs "Keyborg instance kN is
// being disposed incorrectly" when a FluentProvider that hosted a Dialog
// unmounts and no other instance is alive in the window — dev builds only,
// and an app's provider never unmounts. A test file unmounts its provider in
// every test, so whether it fires would depend on test order: an `Input`
// rendered earlier leaves Fluent's window-level instance alive, as an app
// does. Do that once up front, so every test sees what an app sees.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
// Nothing to do with no DOM: the server-rendering test runs under `node`.
if (typeof document !== "undefined") {
  const root = createRoot(document.createElement("div"));
  act(() =>
    root.render(
      <FluentProvider theme={webLightTheme}>
        <Input />
      </FluentProvider>,
    ),
  );
  act(() => root.unmount());
}
