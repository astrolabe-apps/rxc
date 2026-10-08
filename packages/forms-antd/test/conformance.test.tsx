import { describeConformance } from "rxc-forms-conformance/suite";
import { AntdVariantsProvider, antdRenderers, type AntdVariants } from "../src/index";

const variants: AntdVariants = {
  text: { lead: { strong: true, style: (t) => ({ fontSize: t.fontSizeLG }) } },
  group: { card: { wrapper: (t) => ({ padding: t.paddingMD }) } },
  action: { quiet: { type: "text" } },
  image: { rounded: (t) => ({ borderRadius: t.borderRadiusLG }) },
};
describeConformance({
  name: "Ant",
  renderers: antdRenderers,
  looks: (node) => <AntdVariantsProvider variants={variants}>{node}</AntdVariantsProvider>,
});
