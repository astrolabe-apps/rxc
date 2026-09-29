import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import {
  ControlChange,
  untrackedRead,
  attachFields,
  createDerivedGroup,
  detachFields,
} from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";

/**
 * What made a scope: the form itself, a `{ scope: true }` group, a tab strip
 * or wizard as a whole, one of its tabs or pages, or a dialog's content.
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
 * "Is anything under me invalid?" — which the data tree cannot answer on its
 * own, because a tab or a wizard page is not a data node and its fields may
 * bind anywhere.
 *
 * React cannot walk its own children, so it works in reverse: a field's
 * boundary registers its control with the nearest ancestor scope, and a scope
 * registers itself with its parent, so validity reaches every enclosing scope.
 * Registration happens in the boundary, which runs even when the field renders
 * nothing — that is what makes an inactive tab report its errors.
 *
 * The scopes form a tree the author can walk (README finding 75): `<Form>`
 * owns the root, every container that makes a scope attaches it to the one
 * above as a child, and `useValidation()` hands out the nearest. So "is page
 * 2 of the wizard still checking?" is
 * `useValidation().root.find(rc, "signup")?.child(rc, "who")?.pending(rc)`,
 * from anywhere in the form.
 *
 * The scope is a real control — core's `createDerivedGroup`, whose value is
 * composed from its members and never written back down. Derived is what
 * makes overlapping membership safe, and a scope always overlaps: a collection
 * registers its array while its rows register fields inside it. See README
 * finding 37.
 */
export interface ValidationScope {
  kind: ValidationScopeKind;
  /**
   * How a parent finds it: a tab's or page's item key, or a container's
   * `validationKey`. Absent for a scope nobody named — still in `children`.
   */
  key?: string;
  parent?: ValidationScope;
  /** The `<Form>`'s scope; itself for the root. */
  root: ValidationScope;
  /** Scopes attached below this one, in attach order. Reactive. */
  children(rc: ReadContext): ValidationScope[];
  /** The child with this key, if one is attached. Reactive. */
  child(rc: ReadContext, key: string): ValidationScope | undefined;
  /**
   * The first descendant with this key, depth-first — so an author names the
   * scope they care about without spelling out every container above it.
   * Keys are the author's to keep unique. Reactive.
   */
  find(rc: ReadContext, key: string): ValidationScope | undefined;
  /**
   * No *published* error under me. Optimistic while async validators are
   * still running — a step marker must not flash invalid on every keystroke —
   * so a gate awaits `settled()` first, which is what `check()` does.
   */
  isValid(rc: ReadContext): boolean;
  /** An async validator under me has not answered yet. */
  pending(rc: ReadContext): boolean;
  /** Resolves once nothing under me is pending. Immediately, if nothing is. */
  settled(): Promise<void>;
  /** Show the errors that are already there — what a refused Next needs. */
  touchAll(): void;
  /**
   * The gate: wait for pending validators, and if anything is invalid, touch
   * everything so the errors show. Resolves to whether it was valid. What a
   * wizard's Next and a form's submit both are.
   */
  check(): Promise<boolean>;

  // ── Framework half: boundaries and containers, not authors ──
  /**
   * Add a member. `judge` is what validity is read from — a field
   * boundary's *verdict*, which carries only its own rules and the errors
   * nobody claims (README finding 76) — and `touch` is what `touchAll`
   * touches so the errors show: the field's data control.
   */
  register(judge: Control<unknown>, touch: Control<unknown>): () => void;
  /**
   * A field's boundary calls this when one of its validators returns a
   * promise, and the returned function when it answers or is superseded.
   * Counts here and in every enclosing scope.
   */
  beginPending(): () => void;
  /**
   * Join the parent's `children`. Called from the owner's effect, not at
   * creation, so a render that never commits leaves no child behind.
   */
  attach(): () => void;
}

/** Each scope's child list, so `attach` can reach its parent's. */
const childLists = new WeakMap<ValidationScope, Control<ValidationScope[]>>();
/** A scope's aggregate back to the scope, so a parent's touch recurses. */
const scopeOfGroup = new WeakMap<Control<unknown>, ValidationScope>();

export function createValidationScope(
  ctx: ControlContext,
  parent: ValidationScope | undefined,
  kind: ValidationScopeKind,
  key?: string,
): ValidationScope {
  // The aggregate is a real control whose value is derived — composed from
  // the members, never written back down to them. That last part is what
  // makes overlapping membership safe, and a scope always overlaps: a
  // collection registers its array, its rows register fields inside it.
  const group = createDerivedGroup(ctx);
  // Pending async validators, as a control so `pending(rc)` is an ordinary
  // tracked read and `settled()` a subscription.
  const pendingCount = ctx.newControl(0);
  // The children, as a control so `children(rc)` is a tracked read too.
  const childList = ctx.newControl<ValidationScope[]>([]);
  let keys = 0;
  let attachedUp: (() => void) | undefined;
  // What `touchAll` touches: members' data controls, and child scopes'.
  const touchTargets = new Map<string, Control<unknown>>();

  const scope: ValidationScope = {
    kind,
    key,
    parent,
    root: undefined as unknown as ValidationScope,
    children: (rc) => rc.getValue(childList),
    child: (rc, k) => rc.getValue(childList).find((c) => c.key === k),
    find: (rc, k) => {
      for (const c of rc.getValue(childList)) {
        if (c.key === k) return c;
        const hit = c.find(rc, k);
        if (hit) return hit;
      }
      return undefined;
    },
    register(judge, touch) {
      const mkey = "m" + keys++;
      touchTargets.set(mkey, touch);
      ctx.update((wc) => attachFields(wc, group, { [mkey]: judge }));
      // The scope joins its parent once, as a single member: its own
      // aggregate already covers everything below it, and touching this
      // scope's aggregate is how the parent's `touchAll` reaches down.
      attachedUp ??= parent?.register(group, group);
      return () => {
        touchTargets.delete(mkey);
        ctx.update((wc) => detachFields(wc, group, [mkey]));
      };
    },
    // An ordinary tracked read — no fan-out, no version counter.
    isValid: (rc) => rc.isValid(group),
    // The data controls, not the verdicts — a field shows its error when its
    // *data* is touched. A child scope's entry is its aggregate, whose touch
    // is intercepted below and forwarded to that scope's own targets.
    touchAll: () =>
      ctx.update((wc) => {
        for (const t of touchTargets.values()) {
          const child = scopeOfGroup.get(t);
          if (child) child.touchAll();
          else wc.setTouched(t, true);
        }
      }),
    pending: (rc) => rc.getValue(pendingCount) > 0,
    settled: () =>
      new Promise<void>((resolve) => {
        if (untrackedRead.getValue(pendingCount) === 0) return resolve();
        const sub = pendingCount.subscribe(() => {
          if (untrackedRead.getValue(pendingCount) === 0) {
            pendingCount.unsubscribe(sub);
            resolve();
          }
        }, ControlChange.Value);
      }),
    check: async () => {
      await scope.settled();
      const valid = untrackedRead.isValid(group);
      if (!valid) scope.touchAll();
      return valid;
    },
    beginPending: () => {
      const up = parent?.beginPending();
      ctx.update((wc) => wc.updateValue(pendingCount, (n) => n + 1));
      let done = false;
      return () => {
        if (done) return;
        done = true;
        ctx.update((wc) => wc.updateValue(pendingCount, (n) => n - 1));
        up?.();
      };
    },
    attach: () => {
      if (!parent) return () => {};
      const list = childLists.get(parent)!;
      ctx.update((wc) =>
        wc.updateValue(list, (l) => (l.includes(scope) ? l : [...l, scope])),
      );
      return () =>
        ctx.update((wc) =>
          wc.updateValue(list, (l) => l.filter((c) => c !== scope)),
        );
    },
  };
  scope.root = parent?.root ?? scope;
  childLists.set(scope, childList);
  scopeOfGroup.set(group, scope);
  return scope;
}

/**
 * A scope owned by a component: created once per parent/kind/key and
 * attached to its parent while the component is mounted. Every container
 * makes its scopes this way.
 */
export function useChildValidationScope(
  parent: ValidationScope | undefined,
  kind: ValidationScopeKind,
  key?: string,
): ValidationScope;
/** Opt-in: `enabled: false` makes nothing — a group not built `{ scope: true }`. */
export function useChildValidationScope(
  parent: ValidationScope | undefined,
  kind: ValidationScopeKind,
  key: string | undefined,
  enabled: boolean,
): ValidationScope | undefined;
export function useChildValidationScope(
  parent: ValidationScope | undefined,
  kind: ValidationScopeKind,
  key?: string,
  enabled = true,
): ValidationScope | undefined {
  const ctx = useControlContext();
  const scope = useMemo(
    () => (enabled ? createValidationScope(ctx, parent, kind, key) : undefined),
    [ctx, parent, kind, key, enabled],
  );
  useEffect(() => scope?.attach(), [scope]);
  return scope;
}

/** Several at once — a tab strip's tabs, a wizard's pages — keyed by item. */
export function useChildValidationScopes(
  parent: ValidationScope,
  kind: ValidationScopeKind,
  keys: string[],
): Map<string, ValidationScope> {
  const ctx = useControlContext();
  const keyList = keys.join("|");
  const scopes = useMemo(() => {
    const m = new Map<string, ValidationScope>();
    for (const k of keys) m.set(k, createValidationScope(ctx, parent, kind, k));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, parent, kind, keyList]);
  useEffect(() => {
    const detach = [...scopes.values()].map((s) => s.attach());
    return () => detach.forEach((d) => d());
  }, [scopes]);
  return scopes;
}

const Ctx = createContext<ValidationScope | undefined>(undefined);

/** The nearest scope, for the framework — `undefined` outside any `<Form>`. */
export function useValidationScope(): ValidationScope | undefined {
  return useContext(Ctx);
}

/**
 * The author's handle: the nearest validation scope — the page, tab, dialog
 * or section this component sits in, or the form's own. `.root` is the form's
 * from anywhere, and `children` / `child` walk down. Throws outside a
 * `<Form>`, which is the only place a validation question has an answer.
 */
export function useValidation(): ValidationScope {
  const s = useContext(Ctx);
  if (!s)
    throw new Error(
      "useValidation() needs a <Form> above it — it owns the root scope.",
    );
  return s;
}

/**
 * A form's root scope, **owned by the component that renders the `<Form>`**
 * and handed to it: `<Form validation={v}>`. The owner is exactly the
 * component `useValidation()` cannot serve — context only reaches down, and
 * the Save button usually sits beside the form, not inside it — and a ref
 * would not serve it either: `current` is null on the first render and
 * setting it re-renders nothing, so "checking…" or a disabled Save could
 * not be rendered from it. A handle made here exists from the first render,
 * so it reads reactively like anything else. The same pattern as
 * `WizardProps.page`: the author owns the state when they need it outside.
 * README finding 77.
 */
export function useFormValidation(validationKey?: string): ValidationScope {
  // The parent is the owner's context — the same context the `<Form>` it
  // renders sits in, so a form inside a form still attaches under the outer.
  return useChildValidationScope(useValidationScope(), "form", validationKey);
}

export function ValidationScopeProvider({
  value,
  children,
}: {
  value: ValidationScope;
  children: ReactNode;
}) {
  return <Ctx value={value}>{children}</Ctx>;
}
