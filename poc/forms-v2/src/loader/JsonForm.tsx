import { useMemo } from "react";
import type { Control } from "@rx-controls/core";
import { useControlContext } from "@rx-controls/react";
import { translate, type LoaderOptions } from "./translate.js";
import type { ControlDefinition, SchemaField } from "./json.js";

export interface JsonFormProps<T> extends LoaderOptions {
  controls: ControlDefinition[];
  schema: SchemaField[];
  data: Control<T>;
}

/**
 * JSON in, ordinary JSX out. What it produces is what a JSX author would have
 * written — the same boundaries, the same scope, the same registry — so its
 * output composes with hand-written form source in the same tree.
 *
 * Memoised because **translation allocates**: an async expression evaluates
 * into a `Control` and subscribes to the data. A hand-written form allocates
 * nothing per render; a loader does, and has to be told when to stop.
 */
export function JsonForm<T>({
  controls,
  schema,
  data,
  ...opts
}: JsonFormProps<T>) {
  const ctx = useControlContext();
  const tree = useMemo(
    () =>
      controls.map((c, i) =>
        translate(ctx, data as Control<unknown>, schema, c, String(i), opts),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, controls, schema, data],
  );
  return <>{tree}</>;
}
