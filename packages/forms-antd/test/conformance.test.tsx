import { describeConformance } from "rxc-forms-conformance/suite";
import { AntdLooksProvider, antdRenderers, type AntdLooks } from "../src/index";

const looks: AntdLooks = {
  text: { lead: { strong: true, style: (t) => ({ fontSize: t.fontSizeLG }) } },
  group: { card: { wrapper: (t) => ({ padding: t.paddingMD }) } },
  action: { quiet: { type: "text" } },
  image: { rounded: (t) => ({ borderRadius: t.borderRadiusLG }) },
  icon: { large: (t) => ({ fontSize: t.fontSizeHeading1 }) },
};
describeConformance({
  name: "Ant",
  renderers: antdRenderers,
  looks: (node) => <AntdLooksProvider looks={looks}>{node}</AntdLooksProvider>,
});
