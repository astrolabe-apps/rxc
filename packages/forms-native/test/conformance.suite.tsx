import { describeConformance } from "rxc-forms-conformance/suite";
import { nativeRenderers } from "../src/index";

describeConformance({ name: "native", renderers: nativeRenderers });
