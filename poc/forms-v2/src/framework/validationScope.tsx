import { createContext, useContext, type ReactNode } from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import {
  ControlChange,
  untrackedRead,
  attachFields,
  createDerivedGroup,
  detachFields,
  getControlPath,
} from "@rx-controls/core";

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
 * The scope is a real control — core's `createDerivedGroup`, whose value is
 * composed from its members and never written back down. Derived is what
 * makes overlapping membership safe, and a scope always overlaps: a collection
 * registers its array while its rows register fields inside it. See README
 * finding 37.
 */
export interface ValidationScope {
  register(control: Control<unknown>): () => void;
  /**
   * No *published* error under me. Optimistic while async validators are
   * still running — a step marker must not flash invalid on every keystroke —
   * so a gate awaits `settled()` first.
   */
  isValid(rc: ReadContext): boolean;
  /** Show the errors that are already there — what a refused Next needs. */
  touchAll(): void;
  /** An async validator under me has not answered yet. */
  pending(rc: ReadContext): boolean;
  /** Resolves once nothing under me is pending. Immediately, if nothing is. */
  settled(): Promise<void>;
  /**
   * A field's boundary calls this when one of its validators returns a
   * promise, and the returned function when it answers or is superseded.
   * Counts here and in every enclosing scope.
   */
  beginPending(): () => void;
}

// TEMP: a window hook so the registration tree can be inspected.
const allScopes: {
  label: string;
  parent?: ValidationScope;
  self: ValidationScope;
  members: Set<Control<unknown>>;
}[] = [];
(globalThis as Record<string, unknown>).__scopes = () =>
  allScopes.map((s) => ({
    label: s.label,
    parent: allScopes.find((p) => p.self === s.parent)?.label ?? null,
    members: [...s.members].map((c) => getControlPath(c).join(".") || "(root)"),
  }));

export function createValidationScope(
  ctx: ControlContext,
  parent?: ValidationScope,
  label = "scope",
): ValidationScope {
  const members = new Set<Control<unknown>>();
  // The aggregate is a real control whose value is derived — composed from
  // the members, never written back down to them. That last part is what
  // makes overlapping membership safe, and a scope always overlaps: a
  // collection registers its array, its rows register fields inside it.
  const group = createDerivedGroup(ctx);
  // Pending async validators, as a control so `pending(rc)` is an ordinary
  // tracked read and `settled()` a subscription.
  const pendingCount = ctx.newControl(0);
  let keys = 0;
  let attachedUp: (() => void) | undefined;

  const scope: ValidationScope = {
    register(control) {
      members.add(control);
      const key = "m" + keys++;
      ctx.update((wc) => attachFields(wc, group, { [key]: control }));
      // The scope joins its parent once, as a single member: its own
      // aggregate already covers everything below it.
      attachedUp ??= parent?.register(group);
      return () => {
        members.delete(control);
        ctx.update((wc) => detachFields(wc, group, [key]));
      };
    },
    // An ordinary tracked read — no fan-out, no version counter.
    isValid: (rc) => rc.isValid(group),
    // Cascades to the members natively.
    touchAll: () => ctx.update((wc) => wc.setTouched(group, true)),
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
  };
  allScopes.push({ label, parent, self: scope, members });
  return scope;
}

const Ctx = createContext<ValidationScope | undefined>(undefined);

export function useValidationScope(): ValidationScope | undefined {
  return useContext(Ctx);
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
