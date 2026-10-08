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
import type { FocusTarget } from "./controllers.js";

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
   * data control. `active`, a field's validation config, is false while the
   * field is hidden: `touchAll` passes it by.
   */
  register(
    judge: Control<unknown>,
    touch: Control<unknown>,
    active?: Control<{ active: boolean }>,
  ): () => void;
  /**
   * Called when a validator returns a promise; the returned function when it
   * answers or is superseded. Counts here and in every enclosing scope.
   */
  beginPending(): () => void;
  /** Join the parent's `children`. Returns the detach. */
  attach(): () => void;
  /** The focus targets of the fields inside showing an error, in member order. */
  invalidTargets(): FocusTarget[];
  /**
   * The same, each with the child scopes between this one and the field —
   * outermost first — so `focusInvalid` can reveal each on the way down.
   */
  invalidPaths(): { target: FocusTarget; path: ValidationScopeImpl[] }[];
  /**
   * Set by a container whose content can be out of sight — a disclosure, a
   * tab. Asked to show its content before a refused check focuses a field
   * inside: returns `false` when it already shows (go on at once), or
   * opens and returns `true`, promising to call `then` once the opened
   * content has committed.
   */
  reveal?: (then: () => void) => boolean;
}

function isFocusTarget(v: unknown): v is FocusTarget {
  return typeof (v as FocusTarget | null)?.focus === "function";
}

/** Document order where both are DOM nodes; otherwise keep member order. */
function documentOrder(a: FocusTarget, b: FocusTarget): number {
  const node = (t: FocusTarget) =>
    typeof (t as unknown as Node).compareDocumentPosition === "function"
      ? (t as unknown as Node)
      : null;
  const na = node(a);
  const nb = node(b);
  if (!na || !nb || na === nb) return 0;
  // DOCUMENT_POSITION_FOLLOWING: b comes after a.
  return na.compareDocumentPosition(nb) & 4 ? -1 : 1;
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
    {
      judge: Control<unknown>;
      touch: Control<unknown>;
      active?: Control<{ active: boolean }>;
    }
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
    register(judge, touch, active) {
      const mkey = "m" + memberKeys++;
      members.set(mkey, { judge, touch, active });
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
        for (const { touch, active } of members.values()) {
          const child = scopeOfGroup.get(touch);
          if (child) child.touchAll();
          // A hidden field is not validating, and the user has not seen it:
          // touching it would show its error the moment it appears.
          else if (!active || untrackedRead.getValue(active).active)
            wc.setTouched(touch, true);
        }
      }),
    invalidTargets: () => scope.invalidPaths().map((p) => p.target),
    invalidPaths: () => {
      const out: { target: FocusTarget; path: ValidationScopeImpl[] }[] = [];
      for (const { judge, touch } of members.values()) {
        const child = scopeOfGroup.get(touch);
        if (child)
          for (const p of child.invalidPaths())
            out.push({ target: p.target, path: [child, ...p.path] });
        else if (!untrackedRead.isValid(judge) && untrackedRead.isTouched(touch)) {
          const el = touch.meta.element;
          if (isFocusTarget(el)) out.push({ target: el, path: [] });
        }
      }
      return out;
    },
    focusInvalid: () => {
      const first = scope
        .invalidPaths()
        .sort((a, b) => documentOrder(a.target, b.target))[0];
      if (!first) return false;
      // Reveal each enclosing container that hides its content — outermost
      // first, each after the one above has committed — then focus.
      const step = (i: number): void => {
        if (i === first.path.length) return void first.target.focus();
        if (!first.path[i]!.reveal?.(() => step(i + 1))) step(i + 1);
      };
      step(0);
      return true;
    },
    check: async ({ focus = true } = {}) => {
      await scope.settled();
      const valid = untrackedRead.isValid(group);
      if (!valid) {
        scope.touchAll();
        if (focus) scope.focusInvalid();
      }
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
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
