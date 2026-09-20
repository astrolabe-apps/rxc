import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ReadContext } from "@rx-controls/core";
import { getProp, narrowPresence } from "./prop.js";
import type { FormProp, Presence } from "./types.js";

/**
 * The scope holds **rc-resolvers, not values** — a facet driven by form data
 * (a `hidden` expression) reaches the fields that read it as an ordinary
 * control write, with no provider re-rendering a subtree to deliver it.
 *
 * `presence` is derived, never authored: a `hidden` prop narrows it, and only
 * a container implementation narrows it to `silent`.
 */
export interface ScopeState {
  presence(rc: ReadContext): Presence;
  /** The *inherited* locks. A control's own flags are props. */
  disabled(rc: ReadContext): boolean;
  readOnly(rc: ReadContext): boolean;
  /** Form-wide, set on <Form>; `dontClearHidden` is the per-control opt-out. */
  clearHidden: boolean;
  designMode: boolean;
}

const rootScope: ScopeState = {
  presence: () => "rendered",
  disabled: () => false,
  readOnly: () => false,
  clearHidden: false,
  designMode: false,
};

const ScopeContext = createContext<ScopeState>(rootScope);

export function useFormScope(): ScopeState {
  return useContext(ScopeContext);
}

export interface ScopeNarrowing {
  /** What a boundary passes: its own `hidden` prop, already resolved. */
  presence?: FormProp<Presence>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  clearHidden?: boolean;
  designMode?: boolean;
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
  };
}

/**
 * Restriction-only in both directions: used when a field's *bind-time* scope
 * meets the scope where an implementation decided to render it. Neither can
 * re-enable what the other locked.
 */
export function combineScopes(a: ScopeState, b: ScopeState): ScopeState {
  if (a === b) return a;
  return {
    presence: (rc) => narrowPresence(a.presence(rc), b.presence(rc)),
    disabled: (rc) => a.disabled(rc) || b.disabled(rc),
    readOnly: (rc) => a.readOnly(rc) || b.readOnly(rc),
    clearHidden: a.clearHidden || b.clearHidden,
    designMode: a.designMode || b.designMode,
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
  const scope = useMemo(
    () => narrowScope(parent, narrowing),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      parent,
      narrowing.presence,
      narrowing.disabled,
      narrowing.readOnly,
      narrowing.clearHidden,
      narrowing.designMode,
    ],
  );
  return <ScopeContext value={scope}>{children}</ScopeContext>;
}
