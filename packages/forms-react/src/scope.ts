import type { ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import type { Rendered } from "@rx-controls/react";
import type { FormProp } from "./props.js";
import type { ValidationScope } from "./validation.js";
import { notBuilt, notBuiltComponent } from "./notBuilt.js";

/**
 * Where a boundary is, as far as the form is concerned.
 *
 * | state | widget mounted | on screen | validates | cleared by `clearHidden` |
 * |---|---|---|---|---|
 * | `rendered` | yes | yes | yes | no |
 * | `silent` | yes | no — its container hides it | yes | no |
 * | `hidden` | no | no | no | yes |
 *
 * The boundary itself stays mounted in all three states; the table is about the
 * implementation it renders.
 *
 * Presence is derived, never authored. It lives in the scope and only ever
 * narrows — a child cannot be more present than its parent. A `hidden` prop
 * narrows it to `hidden`. A container narrows its off-screen content to
 * `silent`: an inactive tab, an unreached wizard page, a closed dialog.
 * `silent` exists because unmounted is not hidden: switching tabs must not
 * clear what the user typed, or stop reporting an error they have not seen yet.
 *
 * @group Authoring
 */
export type Presence = "rendered" | "silent" | "hidden";

/**
 * What a control cannot answer on its own. A `Control` carries `disabled`,
 * `touched`, `dirty` and its errors, but not `readOnly`, and not the locks of
 * the region it is rendered in — so field state is a function of the control
 * *and* the scope around it. See {@link useFieldState}.
 *
 * @group Implementations
 */
export interface FieldState {
  /** Disabled by the control itself or by any enclosing scope. */
  disabled: boolean;
  /** Read-only by any enclosing scope. */
  readOnly: boolean;
  /** The user has left the field, or a gate has touched it to show its errors. */
  touched: boolean;
  /** The value differs from the control's initial value. */
  dirty: boolean;
  /**
   * Every error on the control, de-duplicated — including ones published by
   * rules on other boundaries over the same control. What a field *shows* is
   * narrower: see {@link FieldRenderProps.error}.
   */
  errors: string[];
}

/**
 * The form's cascade at one position in the tree: presence, the locks, and the
 * form-wide options. Every boundary reads the scope around it, narrows it with
 * its own props, and publishes the result to its children.
 *
 * The scope holds **resolvers, not values**. A `hidden` driven by form data
 * reaches the components that read it as an ordinary control change; no
 * provider re-renders a subtree to deliver it.
 *
 * @group Extensions
 */
export interface ScopeState {
  /** Presence here: the narrowest of every enclosing boundary's. */
  presence(rc: ReadContext): Presence;
  /** Locked by an enclosing boundary. A control's own `disabled` is a prop. */
  disabled(rc: ReadContext): boolean;
  /** Read-only by an enclosing boundary. */
  readOnly(rc: ReadContext): boolean;
  /**
   * Clear a field's value when it becomes `hidden`. Set once on {@link Form};
   * `dontClearHidden` is the only per-control opt-out.
   */
  clearHidden: boolean;
  /**
   * Rendering for a designer: every container shows all its content at once,
   * and actions do nothing.
   */
  designMode: boolean;
  /**
   * Inside an inline container: the children are prose, so a field or display
   * draws a bare inline element with no shell.
   */
  inline: boolean;
}

/**
 * What a boundary or container adds to the scope it sits in. Every facet only
 * narrows: presence can only drop, and a lock can only be added.
 *
 * @group Extensions
 */
export interface ScopeNarrowing {
  /** This region's own presence, narrowed into the parent's. */
  presence?: FormProp<Presence>;
  /** Lock this region. Cannot unlock one an ancestor locked. */
  disabled?: FormProp<boolean>;
  /** Make this region read-only. Cannot undo an ancestor's. */
  readOnly?: FormProp<boolean>;
  /** Override the form-wide `clearHidden` for this region. */
  clearHidden?: boolean;
  /** Render this region for a designer. */
  designMode?: boolean;
  /** Mark this region's children as inline prose. */
  inline?: boolean;
}

/**
 * The props of {@link Form}: the scope root, and the options that belong to a
 * form rather than to the app.
 *
 * @group Authoring
 */
export interface FormProps extends ScopeNarrowing {
  /** The form. */
  children: ReactNode;
  /**
   * The form's name in the validation tree, so an author can find it with
   * {@link ValidationScope.find}.
   */
  validationKey?: string;
  /**
   * The form's root validation scope, made by the component rendering this
   * `<Form>` with {@link useFormValidation} so that component can check and
   * read it. Absent, the form makes its own.
   */
  validation?: ValidationScope;
}

/**
 * The root of one form. It makes the scope's root explicit, so locking a whole
 * form is `<Form readOnly>` rather than a separate provider, and it carries
 * what is genuinely per form: `clearHidden`, the lock that a
 * `disableType: "global"` action holds while it runs, and the root of the
 * validation tree — what {@link useValidation} reaches from inside, and
 * {@link useFormValidation} hands to the component rendering the form.
 *
 * @group Authoring
 */
export const Form: (props: FormProps) => Rendered =
  notBuiltComponent<FormProps>("Form");

/**
 * The scope at this component's position.
 *
 * @group Extensions
 */
export function useFormScope(): ScopeState {
  return notBuilt("useFormScope");
}

/**
 * {@link FieldState} for a control, against the scope at this component's
 * position — which, inside an implementation, is the scope its boundary
 * narrowed and published. Reads through `rc`, so the caller re-renders when
 * any of it changes.
 *
 * @group Implementations
 */
export function useFieldState<T>(
  rc: ReadContext,
  control: Control<T>,
): FieldState {
  return notBuilt("useFieldState");
}

/**
 * A new scope: `parent` narrowed by `narrowing`. Composition of resolvers, so
 * nothing is read until someone asks.
 *
 * @group Extensions
 */
export function narrowScope(
  parent: ScopeState,
  narrowing: ScopeNarrowing,
): ScopeState {
  return notBuilt("narrowScope");
}

/**
 * The props of {@link FormScopeProvider}.
 *
 * @group Extensions
 */
export interface FormScopeProviderProps {
  /** The scope to publish. */
  scope: ScopeState;
  /** The region it applies to. */
  children: ReactNode;
}

/**
 * Publish a scope to a region. With {@link narrowScope} and
 * {@link useBoundScope} it is all a container needs to put content off screen
 * and keep it validating: narrow the region to `silent`, publish it, and hide
 * the region's element. That element must never change, or its subtree
 * remounts; hide it with a style or the `hidden` attribute.
 *
 * @group Extensions
 */
export const FormScopeProvider: (props: FormScopeProviderProps) => Rendered =
  notBuiltComponent<FormScopeProviderProps>("FormScopeProvider");

/**
 * The flags any boundary takes, as a narrowing of the scope around it.
 *
 * @group Extensions
 */
export interface BoundScopeProps {
  /**
   * Narrow to `hidden`. `undefined` from a resolved prop means *pending* — an
   * async expression that has not answered — which renders as shown but holds
   * `clearHidden`, defaults and validation until it answers.
   */
  hidden?: FormProp<boolean | undefined>;
  /** Lock the region. */
  disabled?: FormProp<boolean>;
  /** Make the region read-only. */
  readOnly?: FormProp<boolean>;
}

/**
 * The scope at this position narrowed by a boundary's own flags, folded
 * together with `@rx-controls/react`'s `FormEditState` so a region locked by
 * either is locked for both. What every built-in boundary does first, and what
 * a container written outside the package does to join the cascade.
 *
 * @group Extensions
 */
export function useBoundScope(props: BoundScopeProps): ScopeState {
  return notBuilt("useBoundScope");
}
