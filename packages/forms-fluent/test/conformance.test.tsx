import { tokens } from "@fluentui/react-components";
import { describeConformance } from "rxc-forms-conformance/suite";
import { FluentVariantsProvider, fluentRenderers, type FluentVariants } from "../src/index";

const variants: FluentVariants = {
  text: { lead: { size: 400, weight: "semibold" } },
  group: { card: { wrapper: { padding: tokens.spacingHorizontalL } } },
  action: { quiet: { appearance: "subtle" } },
  image: { rounded: { borderRadius: tokens.borderRadiusLarge } },
};
describeConformance({
  name: "Fluent",
  renderers: fluentRenderers,
  looks: (node) => <FluentVariantsProvider variants={variants}>{node}</FluentVariantsProvider>,
});
