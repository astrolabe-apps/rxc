import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import { useControl } from "@rx-controls/react";
import { getProp, narrowPresence } from "./prop.js";
import type { FieldState, FormProp, Presence } from "./types.js";

/**
 * The scope holds **rc-resolvers, not values** — a facet driven by form data
 * (a `hidden` expression) reaches the fields that read it as an ordinary
 * control write, with no provider re-rendering a subtree to deliver it.
 *
 * `presence` is derived, never authored: a `hidden` prop narrows it, and only
 * a container implementation narrows it to `silent`.
 *
 * It is React context and nothing else: a component reads the scope at its
 * own position in the tree. A binding does not carry one — see README
 * finding 19 for the design that did, and why it was removed.
 */
export interface ScopeState {
  presence(rc: ReadContext): Presence;
  /** The *inherited* locks. A control's own flags are props. */
  disabled(rc: ReadContext): boolean;
  readOnly(rc: ReadContext): boolean;
  /** Form-wide, set on <Form>; `dontClearHidden` is the per-control opt-out. */
  clearHidden: boolean;
  designMode: boolean;
  /**
   * Set by an inline container: the children are prose, not a form column.
   * A field or display boundary hands it to its implementation, which then
   * draws a bare `<span>` — no shell, no label, no block. Legacy passed an
   * `inline` prop to each child `Field`; a container here receives opaque
   * children, so it is a scope facet (README finding 60).
   */
  inline: boolean;
  /**
   * Held by `<Form>`: how many `disableType: "global"` actions are running.
   * The root scope reads it as `disabled`, so one counter locks the form.
   */
  globalLock?: Control<number>;
}

const rootScope: ScopeState = {
  presence: () => "rendered",
  disabled: () => false,
  readOnly: () => false,
  clearHidden: false,
  designMode: false,
  inline: false,
};

const ScopeContext = createContext<ScopeState>(rootScope);

export function useFormScope(): ScopeState {
  return useContext(ScopeContext);
}

/**
 * What a `Control` cannot answer alone: `readOnly` has no home on one, and
 * `disabled` folds in the enclosing scope's. A function of the control *and*
 * the scope where the field is rendered — every boundary calls it with the
 * scope it just narrowed, and publishes that scope so an implementation's
 * `useFieldState` agrees with it.
 */
export function fieldState<T>(
  rc: ReadContext,
  control: Control<T>,
  scope: ScopeState,
): FieldState {
  return {
    disabled: rc.isDisabled(control) || scope.disabled(rc),
    readOnly: scope.readOnly(rc),
    touched: rc.isTouched(control),
    dirty: rc.isDirty(control),
    // A set, not a list: two boundaries over one control each own a
    // `required` key (validation.ts), and the same verdict twice is one error.
    errors: [...new Set(Object.values(rc.getErrors(control)).filter(Boolean))],
  };
}

/** `fieldState` against the scope at this component's position. */
export function useFieldState<T>(
  rc: ReadContext,
  control: Control<T>,
): FieldState {
  return fieldState(rc, control, useFormScope());
}

export interface ScopeNarrowing {
  /** What a boundary passes: its own `hidden` prop, already resolved. */
  presence?: FormProp<Presence>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  clearHidden?: boolean;
  designMode?: boolean;
  inline?: boolean;
}

export function narrowScope(parent: ScopeState, n: ScopeNarrowing): ScopeState {
  return {
    presence: (rc) =>
      narrowPresence(
        parent.presence(rc),
        getProp(rc, n.presence) ?? "rendered",
      ),
    disabled: (rc) => parent.disabled(rc) || (getProp(rc, n.disabled) ?? false),
    readOnly: (rc) => parent.readOnly(rc) || (getProp(rc, n.readOnly) ?? false),
    clearHidden: n.clearHidden ?? parent.clearHidden,
    designMode: n.designMode ?? parent.designMode,
    inline: n.inline ?? parent.inline,
    globalLock: parent.globalLock,
  };
}

export function FormScopeProvider({
  scope,
  children,
}: {
  scope: ScopeState;
  children: ReactNode;
}) {
  return <ScopeContext value={scope}>{children}</ScopeContext>;
}

export interface FormProps extends ScopeNarrowing {
  children: ReactNode;
}

/**
 * The per-form root. Carries what is genuinely per-form rather than per-app —
 * here just `clearHidden` — and makes the scope root explicit, so locking a
 * whole form is `<Form readOnly>` rather than a separate provider.
 */
export function Form({ children, ...narrowing }: FormProps) {
  const parent = useFormScope();
  const globalLock = useControl(0);
  const scope = useMemo(
    () => {
      const { disabled } = narrowing;
      const s = narrowScope(parent, {
        ...narrowing,
        disabled: (rc) =>
          (getProp(rc, disabled) ?? false) || rc.getValue(globalLock) > 0,
      });
      return { ...s, globalLock };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      parent,
      globalLock,
      narrowing.presence,
      narrowing.disabled,
      narrowing.readOnly,
      narrowing.clearHidden,
      narrowing.designMode,
    ],
  );
  return <ScopeContext value={scope}>{children}</ScopeContext>;
}
