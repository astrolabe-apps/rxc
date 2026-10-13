import { describeConformance } from "rxc-forms-conformance/suite";
import { MuiLooksProvider, muiRenderers, type MuiLooks } from "../src/index";

const looks: MuiLooks = {
  text: { lead: { variant: "subtitle1" } },
  group: { card: { wrapper: (t) => ({ padding: t.spacing(2) }) } },
  action: { quiet: { variant: "text" } },
  image: { rounded: (t) => ({ borderRadius: t.shape.borderRadius }) },
  icon: { large: (t) => ({ fontSize: t.typography.h4.fontSize }) },
};
describeConformance({
  name: "MUI",
  renderers: muiRenderers,
  looks: (node) => <MuiLooksProvider looks={looks}>{node}</MuiLooksProvider>,
});
