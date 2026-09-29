/**
 * The Forms v2 contract: everything a form author writes against, everything
 * an implementation fills in, and everything a third party needs to extend
 * either. No DOM and no class strings — an implementation package
 * (`forms-html`, `forms-mui`, `forms-antd`) draws.
 *
 * The reference is grouped by audience:
 *
 * - **Authoring** — writing a form: the built-in components and their props.
 * - **Implementations** — writing an implementation: the registry, what each
 *   slot receives, and the controllers and primitives that make a slot short.
 * - **Extensions** — writing a widget, collection, group or container of your
 *   own: the boundary factories and the scope.
 *
 * @packageDocumentation
 */

export * from "./props.js";
export * from "./scope.js";
export * from "./field.js";
export * from "./collection.js";
export * from "./group.js";
export * from "./display.js";
export * from "./action.js";
export * from "./containers.js";
export * from "./primitives.js";
export * from "./widgets.js";
export * from "./registry.js";
export * from "./builtins.js";
export * from "./controllers.js";
