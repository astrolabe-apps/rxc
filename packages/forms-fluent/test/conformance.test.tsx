import { describeConformance } from "rxc-forms-conformance/suite";
import { fluentRenderers } from "../src/index";

describeConformance({ name: "Fluent", renderers: fluentRenderers });
