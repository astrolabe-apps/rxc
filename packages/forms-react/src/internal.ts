/*
 * @rx-controls/forms-react/internal — for sibling packages only (forms-json,
 * forms-html, forms-mui, forms-antd), the same convention as
 * @rx-controls/core/internal. Not public API: no semver promise, and not in
 * the generated reference.
 */
import type { Control, ReadContext } from "@rx-controls/core";
import type { FormProp } from "./props.js";
import type { ScopeState } from "./scope.js";
import { notBuilt } from "./notBuilt.js";

/**
 * The default-value cycle a field boundary runs on its own binding, for a
 * control no boundary owns — the loader's compound rendered as a group. While
 * the scope is not `hidden` and `hidden` is not pending, an `undefined` value
 * gets the default. Costs the component no re-render.
 */
export function useDefaultValue<T>(
  control: Control<T>,
  defaultValue: FormProp<T> | undefined,
  scope: ScopeState,
  enabled: boolean,
  hidden?: FormProp<boolean | undefined>,
): void {
  return notBuilt("useDefaultValue");
}

/** An asynchronous `hidden` that has not answered yet. */
export function hiddenPending(
  rc: ReadContext,
  hidden: FormProp<boolean | undefined> | undefined,
): boolean {
  return notBuilt("hiddenPending");
}
