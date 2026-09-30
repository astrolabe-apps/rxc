import { describeConformance } from "rxc-forms-conformance/suite";
import { antdRenderers } from "../src/index";

describeConformance({ name: "Ant", renderers: antdRenderers });
