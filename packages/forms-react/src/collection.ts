import type { ComponentType, ReactNode } from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import type { Rendered } from "@rx-controls/react";
import type { FieldProps, FieldRenderProps } from "./field.js";
import type { RegistrySlot } from "./registry.js";
import type { ScopeState } from "./scope.js";
import { notBuilt, notBuiltComponent } from "./notBuilt.js";

/**
 * Add, remove, move and edit for one array, with the bounds its length limits
 * imply. The collection boundary builds these with its own scope, so inside a
 * locked region every `can*` is `false`.
 *
 * @group Authoring
 */
export interface ArrayActions {
  /** How many elements there are now. */
  length: number;
  /** Not locked, and below `maxLength`. */
  canAdd: boolean;
  /** Not locked, and above `minLength`. */
  canRemove: boolean;
  /** Not locked. */
  canEdit: boolean;
  /** Insert an element — at the end, or at `index`. */
  add(value?: unknown, index?: number): void;
  /** Remove the element at `index`. */
  remove(index: number): void;
  /** Move the element at `from` to `to`. */
  move(from: number, to: number): void;
  /**
   * Begin a staged edit of one element: a draft copy that a dialog elsewhere
   * edits and then applies or cancels. See {@link getExternalEdit}. The session
   * ends by itself if this collection locks or hides while it is open.
   */
  edit(index: number): void;
}

/**
 * What an author writes on a collection: a field over an array, whose rows are
 * a render prop.
 *
 * @group Authoring
 */
export interface CollectionProps<T> extends FieldProps<T[]> {
  /**
   * One row, given its element's control. Each row renders in its own tracking
   * window, so editing one element re-renders that row and nothing else.
   * `actions` are this collection's own, scope-aware set.
   */
  children: (
    item: Control<T>,
    index: number,
    actions: ArrayActions,
  ) => ReactNode;
  /** Shown when there are no elements. */
  empty?: ReactNode;
  /** The fewest elements allowed. Registered as a validator on the array itself. */
  minLength?: number;
  /** The most elements allowed. Registered as a validator on the array itself. */
  maxLength?: number;
}

/**
 * One row, as the implementation sees it: the author's row, already rendered
 * in its own tracking window, plus what chrome on a row needs — a remove
 * column, an Edit button.
 *
 * @group Implementations
 */
export interface CollectionElement<T> {
  /** A stable key: the element control's `uniqueId`, not its index. */
  key: number;
  /** Its position now. */
  index: number;
  /** The element's control. */
  field: Control<T>;
  /** The author's row. */
  node: ReactNode;
}

/**
 * What a collection implementation receives. The three things easy to get
 * wrong — subscribing to structure only, a tracking window per row, keying by
 * `uniqueId` — are done before it sees them.
 *
 * @group Implementations
 */
export interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  /** The rows. */
  elements: CollectionElement<T>[];
  /** This collection's actions, for an Add button or per-row chrome. */
  actions: ArrayActions;
  /** Shown when there are no elements. */
  empty?: ReactNode;
}

/**
 * What a collection boundary draws with: a component of its own, or a
 * registry slot.
 *
 * @group Extensions
 */
export type CollectionImplSource<T, P extends object> =
  | ComponentType<CollectionRenderProps<T> & P>
  | RegistrySlot;

/**
 * Build a collection component. Everything {@link fieldRenderer} does — on the
 * array itself, so a length validator and `clearHidden` reach it — plus the
 * three things an implementation must not be trusted to redo: subscribe to
 * structure only, give every row its own tracking window, and key rows by
 * their control's `uniqueId`.
 *
 * @group Extensions
 */
export function collectionRenderer<T, P extends object = {}>(
  source: CollectionImplSource<T, P>,
): <V extends T>(props: CollectionProps<V> & P) => Rendered {
  return notBuiltComponent("collectionRenderer");
}

/**
 * Bounds and context for {@link arrayActions}.
 *
 * @group Authoring
 */
export interface ArrayActionOptions {
  /** The fewest elements allowed. */
  minLength?: number;
  /** The most elements allowed. */
  maxLength?: number;
  /**
   * The scope whose locks fold into the `can*` flags. Absent for buttons drawn
   * outside any boundary.
   */
  scope?: ScopeState;
}

/**
 * The {@link ArrayActions} for an array, for buttons drawn outside the
 * collection that owns it — a toolbar above a list, say. Takes an `rc` and
 * returns values, with no React involved, so it is not a hook.
 *
 * @group Authoring
 */
export function arrayActions<T>(
  rc: ReadContext,
  ctx: ControlContext,
  control: Control<T[]>,
  options?: ArrayActionOptions,
): ArrayActions {
  return notBuilt("arrayActions");
}

/**
 * An element being edited in a staged session.
 *
 * @group Authoring
 */
export interface EditSession<T> {
  /** Which element. */
  index: number;
  /** A copy of it — an ordinary control. Nothing reaches the array until {@link ExternalEdit.apply}. */
  draft: Control<T>;
}

/**
 * The staged-edit controller for one array: at most one session at a time,
 * shared by everything that asks for this array's controller.
 *
 * @group Authoring
 */
export interface ExternalEdit<T> {
  /** The open session, if any. Reads through `rc`. */
  session(rc: ReadContext): EditSession<T> | undefined;
  /** Open a session over the element at `index`. */
  beginEdit(index: number): void;
  /** Write the draft back to the element and close the session. */
  apply(): void;
  /** Close the session, discarding the draft. */
  cancel(): void;
}

/**
 * The staged-edit controller for an array, created on first use and cached on
 * the array's control — so the collection that begins an edit and the dialog
 * that hosts it share one session without being anywhere near each other in
 * the tree. Not a hook: it may be called anywhere.
 *
 * @group Authoring
 */
export function getExternalEdit<T>(
  ctx: ControlContext,
  control: Control<T[]>,
): ExternalEdit<T> {
  return notBuilt("getExternalEdit");
}
