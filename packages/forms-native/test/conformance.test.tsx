import { describeConformance } from "rxc-forms-conformance/suite";
import { NativeThemeProvider, nativeRenderers } from "../src/index";

describeConformance({
  name: "native",
  renderers: nativeRenderers,
  // React Native's own limits; the suite asserts what it can do instead.
  limits: { dialogMovesContent: true, noFormElement: true, htmlAsText: true, classLooks: true },
  looks: (node) => (
    <NativeThemeProvider
      theme={{
        looks: {
          lead: { control: { fontSize: 18 } },
          card: { shell: { padding: 16 } },
          quiet: { control: { backgroundColor: "transparent" } },
          rounded: { control: { borderRadius: 8 } },
          large: { control: { fontSize: 30 } },
        },
      }}
    >
      {node}
    </NativeThemeProvider>
  ),
});
