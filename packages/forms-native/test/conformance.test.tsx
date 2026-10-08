import { describeConformance } from "rxc-forms-conformance/suite";
import { nativeRenderers } from "../src/index";

describeConformance({
  name: "native",
  renderers: nativeRenderers,
  // React Native's own limits; the suite asserts what it can do instead.
  limits: { dialogMovesContent: true, noFormElement: true, htmlAsText: true },
});
