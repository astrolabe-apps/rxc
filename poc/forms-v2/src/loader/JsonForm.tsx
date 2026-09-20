import { useMemo, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import {
  translateForm,
  type LoaderOptions,
  type LoaderWarning,
} from "./translate.js";
import type { ControlDefinition, SchemaField } from "./json.js";

export interface JsonFormProps<T> extends LoaderOptions {
  controls: ControlDefinition[];
  schema: SchemaField[];
  data: Control<T>;
  /**
   * What to do about JSON the loader could not carry across. Given the list
   * rather than a policy, because open decision 2 says the policy is the
   * host's: render them, log them, assert on them in a fixture, or fail a
   * build over a form corpus. Absent, they are dropped — the same silence as
   * before, but now it is a choice someone made.
   */
  renderWarnings?: (warnings: LoaderWarning[]) => ReactNode;
}

/**
 * JSON in, ordinary JSX out. What it produces is what a JSX author would have
 * written — the same boundaries, the same scope, the same registry — so its
 * output composes with hand-written form source in the same tree.
 *
 * Memoised because **translation allocates**: an async expression evaluates
 * into a `Control` and subscribes to the data. A hand-written form allocates
 * nothing per render; a loader does, and has to be told when to stop. The
 * warnings ride the same memo, so they are produced once per translation
 * rather than once per render.
 */
export function JsonForm<T>({
  controls,
  schema,
  data,
  renderWarnings,
  ...opts
}: JsonFormProps<T>) {
  const ctx = useControlContext();
  const { tree, warnings } = useMemo(
    () => translateForm(ctx, data as Control<unknown>, schema, controls, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, controls, schema, data],
  );
  return (
    <>
      {warnings.length > 0 && renderWarnings?.(warnings)}
      {tree}
    </>
  );
}
