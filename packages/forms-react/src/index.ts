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
// Named, not `*`: scope.tsx also holds the framework's own scope facets.
export {
  Form,
  FormScopeProvider,
  narrowScope,
  useBoundScope,
  useFieldState,
  useFormScope,
  type BoundScopeProps,
  type FieldState,
  type FormProps,
  type FormScopeProviderProps,
  type Presence,
  type ScopeNarrowing,
  type ScopeState,
} from "./scope.js";
export * from "./field.js";
export * from "./validation.js";
export * from "./collection.js";
export * from "./group.js";
export * from "./display.js";
export * from "./richText.js";
export * from "./action.js";
export * from "./containers.js";
export * from "./primitives.js";
export * from "./widgets.js";
// Named, not `*`: registry.tsx also holds `Form`'s optional lookup.
export {
  FormProvider,
  FormRenderers,
  useRenderers,
  type FormElementProps,
  type FormProviderProps,
  type FormRenderersProps,
  type RegistrySlot,
} from "./registry.js";
export * from "./builtins.js";
export * from "./controllers.js";
