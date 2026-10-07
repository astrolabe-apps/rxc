import { memo, type ComponentType, type ReactNode } from "react";
import { FormEditProvider } from "@rx-controls/react";
import type { Control, ReadContext } from "@rx-controls/core";
import type { FormRenderers, RegistrySlot } from "./registry.js";
import type { ScopeState } from "./scope.js";
import type { VisibilityProps } from "./primitives.js";

/**
 * What a boundary reads about its control: the two locks and `touched`, and
 * nothing more. Not `fieldState()` — that also reads the control's `dirty`
 * and errors, and subscribing to those would re-render the boundary (and, for
 * a collection, every row) on the first edit and on every error any other
 * boundary publishes. The boundary's errors come from its own verdict.
 */
export function boundaryState(
  rc: ReadContext,
  control: Control<unknown>,
  scope: ScopeState,
): { disabled: boolean; readOnly: boolean; touched: boolean } {
  return {
    disabled: rc.isDisabled(control) || scope.disabled(rc),
    readOnly: scope.readOnly(rc),
    touched: rc.isTouched(control),
  };
}

/*
 * What every boundary shares. Not exported from the package.
 */

/**
 * The boundary's folded locks, handed back down as `@rx-controls/react`'s
 * `FormEditState`, so a widget built on the binding layer (`ControlInput`,
 * `useFormControlProps`) obeys exactly what a built-in does. The value
 * published is the merged absolute one, so the provider replacing rather than
 * merging does not matter.
 *
 * **Always rendered.** Skipping it when nothing is locked would change the
 * element at this position the moment a lock toggles, and React would remount
 * the implementation — focus, selection and animation state gone with it.
 */
export function republish(
  node: ReactNode,
  disabled: boolean,
  readOnly: boolean,
): ReactNode {
  return (
    <FormEditProvider disabled={disabled} readOnly={readOnly}>
      {node}
    </FormEditProvider>
  );
}

/**
 * Design mode's outline, rendered only in design mode. Outside it the boundary
 * adds no element: a wrapper, even a `display: contents` one, still sits
 * between a body and its children, and the utilities that style children
 * through their parent (`space-y-*`, `divide-y`) land on it and do nothing,
 * since it has no box. The price is a remount when design mode toggles, which
 * a form does not do while it is being used.
 */
export function designChrome(node: ReactNode, on: boolean): ReactNode {
  return on ? (
    <div className="rxf-boundary" data-design="">
      {node}
    </div>
  ) : (
    node
  );
}

/**
 * The `visibility` a boundary renders through: the implementation's slot, or —
 * with the scope's transitions off — one that mounts and unmounts at once and
 * adds no element. The choice is the scope's, fixed for a region, so the
 * component at this position does not change under a mounted widget.
 */
export function visibilityFor(
  renderers: FormRenderers,
  scope: ScopeState,
): ComponentType<VisibilityProps> {
  return scope.transitions ? renderers.visibility : Immediate;
}

function Immediate({ visible, children }: VisibilityProps): ReactNode {
  return visible ? children : null;
}

/** A component of the boundary's own, or the active implementation's slot. */
export function resolveImpl(
  source: ComponentType<never> | RegistrySlot,
  renderers: FormRenderers,
): ComponentType<Record<string, unknown>> {
  return (
    "key" in source ? renderers[source.key] : source
  ) as ComponentType<Record<string, unknown>>;
}

/** The props outside the contract: they reach the implementation as written. */
export function extraProps(
  props: object,
  contractKeys: ReadonlySet<string>,
): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (!contractKeys.has(k)) extra[k] = v;
  return extra;
}

/** A readable `displayName` for a boundary over `source`. */
export function boundaryName(
  kind: string,
  source: ComponentType<never> | RegistrySlot,
): string {
  const inner =
    "key" in source
      ? String(source.key)
      : (source.displayName ?? source.name ?? "anonymous");
  return `${kind}(${inner})`;
}

/** A field's contract props: the boundary consumes these; the rest pass on. */
export const fieldContractKeys: ReadonlySet<string> = new Set([
  "field",
  "id",
  "hidden",
  "disabled",
  "readOnly",
  "dontClearHidden",
  "clearTo",
  "defaultValue",
  "label",
  "hideLabel",
  "required",
  "requiredMessage",
  "validate",
  "helpText",
  "startIcon",
  "endIcon",
  "className",
  "labelClassName",
  "labelTextClassName",
  "shellClassName",
  "textClassName",
]);

/**
 * A leaf boundary as a memo bailout point. The boundary reads everything
 * reactive through its own window, so it re-renders by itself when what it
 * shows moves; what `memo` adds is that an author re-rendering with the same
 * props stops here instead of re-running every field below it. Props an
 * author writes inline — an arrow for a derived label, a `validate` literal —
 * are a new identity each render and simply miss, which is correct: they may
 * close over something that moved.
 *
 * Containers are not wrapped: they take `children` or `items`, which are a
 * new identity on every render, so the comparison would always miss.
 */
export function bailout<C extends (props: never) => ReactNode>(component: C): C {
  const m = memo(component as unknown as ComponentType<object>) as unknown as C & {
    displayName?: string;
  };
  m.displayName = (component as { displayName?: string }).displayName;
  return m;
}
