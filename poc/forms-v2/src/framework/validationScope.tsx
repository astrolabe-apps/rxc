import { createContext, useContext, type ReactNode } from "react";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { untrackedRead } from "@rx-controls/core";

/**
 * "Is anything under me invalid?" — which the data tree cannot answer, because
 * a tab is not a data node and its fields may bind anywhere.
 *
 * React cannot walk its own children, so it works in reverse: a field's
 * boundary registers its control with the nearest ancestor scope, and a scope
 * registers upward too, so validity reaches every enclosing scope. Registration
 * happens in the boundary, which runs even when the field renders nothing —
 * that is what makes an inactive tab report its errors.
 *
 * Core has no primitive for this: `createControlGroup` composes *values*
 * through a parent, which a validity scope never wants. A real implementation
 * wants a structural parent link that aggregates validity without value flow.
 */
export interface ValidationScope {
  register(control: Control<unknown>): () => void;
  isValid(rc: ReadContext): boolean;
}

export function createValidationScope(
  ctx: ControlContext,
  parent?: ValidationScope,
): ValidationScope {
  const members = new Set<Control<unknown>>();
  const version = ctx.newControl(0);
  const bump = () =>
    ctx.update((wc) =>
      wc.setValue(version, untrackedRead.getValue(version) + 1),
    );
  return {
    register(control) {
      members.add(control);
      bump();
      const up = parent?.register(control);
      return () => {
        members.delete(control);
        bump();
        up?.();
      };
    },
    isValid(rc) {
      rc.getValue(version); // re-run when membership changes
      let ok = true;
      // Deliberately no early exit: every member must be subscribed, or a
      // later failure in one of them would go unnoticed.
      for (const c of members) if (!rc.isValid(c)) ok = false;
      return ok;
    },
  };
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
