/**
 * The standard action ids.
 *
 * An id is the only handle a host has on a button it did not write — one the
 * loader produced from JSON, or one a renderer draws itself (a collection's
 * Add, a modal's Apply). Overriding a button's appearance is therefore keyed
 * by id (`useActionOverrides`), and that only works if the ids are *known*.
 *
 * Rules for the set:
 *
 * - **Every button the framework draws itself uses one of these.** No renderer
 *   invents an id privately, or it cannot be overridden.
 * - **A definition may rename one** — a collection takes `addActionId`,
 *   defaulting to `add` — so two grids on one page can be styled apart.
 * - **Ids are camelCase and name the deed, not the look**: `apply`, not
 *   `primaryButton`. Appearance is `style` plus the override map.
 */
export const StandardActionIds = {
  /** Append an element to a collection. */
  add: "add",
  /** Remove one element from a collection. */
  remove: "remove",
  /** Open a staged edit for one element. */
  edit: "edit",
  /** Commit a staged edit. */
  apply: "apply",
  /** Discard a staged edit. */
  cancel: "cancel",
  /** Advance a wizard. */
  next: "next",
  /** Go back a wizard page. */
  back: "back",
} as const;

export type StandardActionId =
  (typeof StandardActionIds)[keyof typeof StandardActionIds];
