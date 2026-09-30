/*
 * rxc-forms-conformance — private. The fixtures written from outside the
 * packages: the third-party widgets (a field, a collection, a group, a
 * `silent` container) and the JSON fixture form; their own surfaces are in
 * `widgets.css`. The suite every implementation runs is the `./suite`
 * subpath, apart so an app using the fixtures never bundles vitest.
 */

export { Stars, type StarsExtra } from "./widgets/Stars.js";
export { PetCards, type PetCardsExtra } from "./widgets/PetCards.js";
export { Collapsible, type CollapsibleExtra } from "./widgets/Collapsible.js";
export {
  SelectChild,
  type SelectChildItem,
  type SelectChildProps,
} from "./widgets/SelectChild.js";
export { demoControls, demoSchema } from "./fixtures/demoForm.js";
