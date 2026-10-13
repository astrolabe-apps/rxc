import { tokens } from "@fluentui/react-components";
import { describeConformance } from "rxc-forms-conformance/suite";
import { FluentLooksProvider, fluentRenderers, type FluentLooks } from "../src/index";

const looks: FluentLooks = {
  text: { lead: { size: 400, weight: "semibold" } },
  group: { card: { wrapper: { padding: tokens.spacingHorizontalL } } },
  action: { quiet: { appearance: "subtle" } },
  image: { rounded: { borderRadius: tokens.borderRadiusLarge } },
  icon: { large: { fontSize: tokens.fontSizeHero700 } },
};
describeConformance({
  name: "Fluent",
  renderers: fluentRenderers,
  looks: (node) => <FluentLooksProvider looks={looks}>{node}</FluentLooksProvider>,
});
