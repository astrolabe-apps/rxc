import { describeConformance } from "rxc-forms-conformance/suite";
import { NativeThemeProvider, nativeRenderers } from "../src/index";

describeConformance({
  name: "native",
  renderers: nativeRenderers,
  // React Native's own limits; the suite asserts what it can do instead.
  limits: { dialogMovesContent: true, noFormElement: true, htmlAsText: true },
  looks: (node) => (
    <NativeThemeProvider
      theme={{
        text: { variants: { lead: "text-lg" } },
        contents: { variants: { card: { className: "p-4" } } },
        action: { variants: { quiet: { className: "bg-transparent" } } },
      }}
    >
      {node}
    </NativeThemeProvider>
  ),
});
