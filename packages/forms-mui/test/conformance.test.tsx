import { describeConformance } from "rxc-forms-conformance/suite";
import { MuiVariantsProvider, muiRenderers, type MuiVariants } from "../src/index";

const variants: MuiVariants = {
  text: { lead: { variant: "subtitle1" } },
  group: { card: { wrapper: (t) => ({ padding: t.spacing(2) }) } },
  action: { quiet: { variant: "text" } },
  image: { rounded: (t) => ({ borderRadius: t.shape.borderRadius }) },
};
describeConformance({
  name: "MUI",
  renderers: muiRenderers,
  looks: (node) => <MuiVariantsProvider variants={variants}>{node}</MuiVariantsProvider>,
});
