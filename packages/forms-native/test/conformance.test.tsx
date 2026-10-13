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
        looks: {
          lead: { control: "text-lg" },
          card: { shell: "p-4" },
          quiet: { control: "bg-transparent" },
          rounded: { control: "rounded-lg" },
          large: { control: "text-3xl" },
        },
      }}
    >
      {node}
    </NativeThemeProvider>
  ),
});
