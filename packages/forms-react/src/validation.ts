import type { ReadContext } from "@rx-controls/core";
import {
  useChildValidationScope,
  useValidationScope,
} from "./validationScope.js";

/**
 * What made a validation scope.
 *
 * - `form` — a {@link Form}: the root.
 * - `section` — a group built `{ scope: true }`, such as {@link Section}.
 * - `tabs` / `wizard` — a tab strip or wizard as a whole.
 * - `tab` / `page` — one of its tabs or pages.
 * - `dialog` — a dialog's content.
 *
 * @group Authoring
 */
export type ValidationScopeKind =
  | "form"
  | "section"
  | "tabs"
  | "tab"
  | "wizard"
  | "page"
  | "dialog";

/**
 * One region's validity: a form, a section, a tab, a wizard page, a dialog.
 * The scopes form a tree — {@link Form} owns the root, and every container
 * that makes a scope attaches it under the one it sits in — so an author can
 * ask about any region from anywhere in the form. Reads take an `rc` and
 * re-render the reader when they change.
 *
 * **A scope judges only the rules written inside it.** A field shown on a
 * page and required on another tab does not make the page invalid; the rule
 * belongs to the tab. Errors *no* rule wrote — a server rejection set on the
 * data by hand — are about the value, so they count in every scope showing
 * the field, while that field is validating. The data itself still carries
 * every error, so `valid` on a `Control` keeps meaning "the data is valid".
 *
 * @group Authoring
 */
export interface ValidationScope {
  /** What made it. */
  readonly kind: ValidationScopeKind;
  /**
   * How a parent finds it: a tab's or page's item key, or a container's
   * `validationKey`. Absent for a scope nobody named — still in `children`.
   */
  readonly key?: string;
  /** The scope this one is attached under. Absent at the root. */
  readonly parent?: ValidationScope;
  /** The form's scope. The root's `root` is itself. */
  readonly root: ValidationScope;
  /** The scopes attached directly under this one, in the order they mounted. */
  children(rc: ReadContext): ValidationScope[];
  /** The child with this key, if one is mounted. */
  child(rc: ReadContext, key: string): ValidationScope | undefined;
  /**
   * The first descendant with this key, depth-first — so an author names the
   * region they care about without spelling out every container above it.
   * Keeping keys unique is the author's job.
   */
  find(rc: ReadContext, key: string): ValidationScope | undefined;
  /**
   * No rule inside has a published error. Optimistic while asynchronous
   * validators are still running, so a step marker does not flash invalid on
   * every keystroke; anything that has to *decide* uses {@link ValidationScope.check}.
   */
  isValid(rc: ReadContext): boolean;
  /**
   * A touched field inside is showing an error — what a marker on a tab, a
   * step or a section header reports, so the marker and the errors on screen
   * always agree. A container touches what it held when the user leaves it
   * (another tab, another page, a dialog closing), the way a field is touched
   * on blur; nothing is showing on a form nobody has touched.
   */
  showingErrors(rc: ReadContext): boolean;
  /** An asynchronous validator inside has not answered yet. */
  pending(rc: ReadContext): boolean;
  /** Resolves once nothing inside is pending. At once, if nothing is. */
  settled(): Promise<void>;
  /** Touch every field inside, so the errors it already has show. */
  touchAll(): void;
  /**
   * The gate: wait for pending validators, and if anything inside is invalid,
   * touch everything so the errors show. Resolves to whether it was valid. A
   * form's submit is `root.check()`; a wizard's Next is its page's.
   */
  check(): Promise<boolean>;
  /**
   * Move focus to the first field inside that is showing an error — first in
   * document order where the widgets are DOM elements. Reaches a field
   * through the element its widget publishes (`control.meta.element`).
   * Returns whether there was one. A refused `<Form onSubmit>` calls it.
   */
  focusInvalid(): boolean;
}

/**
 * The nearest validation scope, for a component **inside** a form — the page,
 * tab, dialog or section it sits in, or the form's own — and from it `.root`,
 * the form's. Throws outside a {@link Form}.
 *
 * It reads context, so it cannot serve the component that renders the
 * `<Form>` itself; that component owns the form's scope instead, with
 * {@link useFormValidation}.
 *
 * ```tsx
 * // "Is the wizard's Who page still checking?" — from anywhere in the form.
 * const who = useValidation().root.find(rc, "signup")?.child(rc, "who");
 * who?.pending(rc);
 * ```
 *
 * @group Authoring
 */
export function useValidation(): ValidationScope {
  const scope = useValidationScope();
  if (!scope)
    throw new Error(
      "useValidation() needs a <Form> above it — the form owns the root validation scope. The component that renders the <Form> uses useFormValidation() instead.",
    );
  return scope;
}

/**
 * A form's root validation scope, **owned by the component that renders the
 * `<Form>`**, which hands it in with `<Form validation={…}>`. The handle exists
 * from the first render, so the owner reads it reactively like any other
 * scope — which a ref could not give it — and a submit is its `check()`:
 *
 * ```tsx
 * const validation = useFormValidation();
 * return rendered(
 *   <>
 *     <Form validation={validation}>…</Form>
 *     {validation.pending(rc) && "checking…"}
 *     <Action
 *       actionId="save"
 *       onClick={async () => { if (await validation.check()) await save(); }}
 *     />
 *   </>,
 * );
 * ```
 *
 * A `<Form>` given none makes its own. A form inside a form attaches under the
 * outer one either way.
 *
 * @param validationKey - the form's name in the validation tree, when forms nest
 * @group Authoring
 */
export function useFormValidation(validationKey?: string): ValidationScope {
  // The parent is the owner's context — the context the `<Form>` it renders
  // sits in — so a form inside a form still attaches under the outer one.
  return useChildValidationScope(useValidationScope(), "form", validationKey);
}
