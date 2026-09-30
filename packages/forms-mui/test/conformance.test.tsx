import { describeConformance } from "rxc-forms-conformance/suite";
import { muiRenderers } from "../src/index";

describeConformance({ name: "MUI", renderers: muiRenderers });
