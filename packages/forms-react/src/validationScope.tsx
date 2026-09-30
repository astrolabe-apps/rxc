import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { Control, ControlContext } from "@rx-controls/core";
import {
  ControlChange,
  attachFields,
  createDerivedGroup,
  detachFields,
  untrackedRead,
} from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import type { ValidationScope, ValidationScopeKind } from "./validation.js";

/*
 * The validation scope tree — the implementation behind the public
 * `ValidationScope`. Not exported from the package: `register`,
 * `beginPending` and `attach` are the framework's half.
 *
 * React cannot walk its own children, so validity is gathered in reverse: a
 * field's boundary registers with the nearest scope, and a scope registers
 * with its parent, so validity reaches every enclosing scope. Registration
 * happens in the boundary, which runs even when the field renders nothing —
 * that is what makes an inactive tab report its errors.
 *
 * Each scope is a real control — core's `createDerivedGroup`, whose value is
 * composed from its members and never written back down. Derived is what
 * makes overlapping membership safe, and a scope always overlaps: a
 * collection registers its array while its rows register fields inside it.
 *
 * Separately from membership, every scope is a node in a tree an author walks
 * (`children` / `child` / `find`). A scope joins its parent's `children` from
 * its owner's effect, so a render that never commits leaves nothing behind.
 */

export interface ValidationScopeImpl extends ValidationScope {
  readonly parent?: ValidationScopeImpl;
  readonly root: ValidationScopeImpl;
  /**
   * Add a member. `judge` is what validity is read from — a field boundary's
   * verdict, which carries only its own rules and the errors no rule claims —
   * and `touch` is what `touchAll` touches so the errors show: the field's
   * data control.
   */
  register(judge: Control<unknown>, touch: Control<unknown>): () => void;
  /**
   * Called when a validator returns a promise; the returned function when it
   * answers or is superseded. Counts here and in every enclosing scope.
   */
  beginPending(): () => void;
  /** Join the parent's `children`. Returns the detach. */
  attach(): () => void;
}

/** Each scope's child list, so `attach` can reach its parent's. */
const childLists = new WeakMap<
  ValidationScopeImpl,
  Control<ValidationScopeImpl[]>
>();
/** A scope's aggregate back to the scope, so a parent's touch recurses. */
const scopeOfGroup = new WeakMap<Control<unknown>, ValidationScopeImpl>();

export function createValidationScope(
  ctx: ControlContext,
  parent: ValidationScopeImpl | undefined,
  kind: ValidationScopeKind,
  key?: string,
): ValidationScopeImpl {
  const group = createDerivedGroup(ctx);
  // Pending asynchronous validators, and the child list, as controls: so
  // `pending(rc)` and `children(rc)` are ordinary tracked reads.
  const pendingCount = ctx.newControl(0);
  const childList = ctx.newControl<ValidationScopeImpl[]>([]);
  // Each member's verdict and what touching it touches: a field's data
  // control, or a child scope's aggregate, which forwards to that scope.
  // Bumped on every change so `showingErrors(rc)` follows membership.
  const members = new Map<
    string,
    { judge: Control<unknown>; touch: Control<unknown> }
  >();
  const membership = ctx.newControl(0);
  let memberKeys = 0;
  let attachedUp: (() => void) | undefined;

  const scope: ValidationScopeImpl = {
    kind,
    key,
    parent,
    root: undefined as unknown as ValidationScopeImpl,
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
      const mkey = "m" + memberKeys++;
      members.set(mkey, { judge, touch });
      ctx.update((wc) => {
        attachFields(wc, group, { [mkey]: judge });
        wc.updateValue(membership, (n) => n + 1);
      });
      // The scope joins its parent once, as a single member: its own
      // aggregate already covers everything below it.
      attachedUp ??= parent?.register(group, group);
      return () => {
        members.delete(mkey);
        ctx.update((wc) => {
          detachFields(wc, group, [mkey]);
          wc.updateValue(membership, (n) => n + 1);
        });
      };
    },
    isValid: (rc) => rc.isValid(group),
    showingErrors: (rc) => {
      rc.getValue(membership);
      for (const { judge, touch } of members.values()) {
        const child = scopeOfGroup.get(touch);
        if (child ? child.showingErrors(rc) : !rc.isValid(judge) && rc.isTouched(touch))
          return true;
      }
      return false;
    },
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
    touchAll: () =>
      ctx.update((wc) => {
        for (const { touch } of members.values()) {
          const child = scopeOfGroup.get(touch);
          if (child) child.touchAll();
          else wc.setTouched(touch, true);
        }
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
  (scope as { root: ValidationScopeImpl }).root = parent?.root ?? scope;
  childLists.set(scope, childList);
  scopeOfGroup.set(group, scope);
  return scope;
}

/**
 * A scope owned by a component: created once per parent / kind / key and
 * attached to its parent while the component is mounted. `enabled: false`
 * makes nothing — a group not built `{ scope: true }`.
 */
export function useChildValidationScope(
  parent: ValidationScopeImpl | undefined,
  kind: ValidationScopeKind,
  key?: string,
): ValidationScopeImpl;
export function useChildValidationScope(
  parent: ValidationScopeImpl | undefined,
  kind: ValidationScopeKind,
  key: string | undefined,
  enabled: boolean,
): ValidationScopeImpl | undefined;
export function useChildValidationScope(
  parent: ValidationScopeImpl | undefined,
  kind: ValidationScopeKind,
  key?: string,
  enabled = true,
): ValidationScopeImpl | undefined {
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
  parent: ValidationScopeImpl,
  kind: ValidationScopeKind,
  keys: string[],
): Map<string, ValidationScopeImpl> {
  const ctx = useControlContext();
  const keyList = JSON.stringify(keys);
  const scopes = useMemo(() => {
    const m = new Map<string, ValidationScopeImpl>();
    for (const k of JSON.parse(keyList) as string[])
      m.set(k, createValidationScope(ctx, parent, kind, k));
    return m;
  }, [ctx, parent, kind, keyList]);
  useEffect(() => {
    const detach = [...scopes.values()].map((s) => s.attach());
    return () => detach.forEach((d) => d());
  }, [scopes]);
  return scopes;
}

const Ctx = createContext<ValidationScopeImpl | undefined>(undefined);

/** The nearest scope, for the framework — `undefined` outside any `<Form>`. */
export function useValidationScope(): ValidationScopeImpl | undefined {
  return useContext(Ctx);
}

export function ValidationScopeProvider({
  value,
  children,
}: {
  value: ValidationScopeImpl;
  children: ReactNode;
}) {
  return <Ctx value={value}>{children}</Ctx>;
}
