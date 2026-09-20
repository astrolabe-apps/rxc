import jsonata from "jsonata";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import {
  ControlChange,
  ensureMetaValue,
  untrackedRead,
} from "@rx-controls/core";
import { getProp, type FormProp } from "../framework/index.js";
import type { EntityExpression } from "./json.js";

function child(data: Control<unknown>, path: string): Control<unknown> {
  return (data as Control<Record<string, unknown>>).fields[
    path
  ] as Control<unknown>;
}

function isEmpty(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0)
  );
}

/**
 * An expression becomes a `FormProp` and stops existing. This is where the
 * expression engine terminates: nothing downstream — no boundary, no renderer
 * — ever learns that a prop came from JSON rather than from an author.
 *
 * Two of the three shapes a `FormProp` can take are needed, and the reason is
 * here rather than anywhere else:
 *
 * - a **synchronous** evaluator is a `(rc) => T`, read in the consumer's own
 *   tracking window, so it re-renders exactly the fields that read it;
 * - an **async** one (jsonata) cannot be, because `(rc) => T` must return now.
 *   It evaluates into a `Control<T>` and the prop *is* that control — which
 *   `FormProp<T>` already allows. Without the control arm of that union, async
 *   expressions would need a second mechanism.
 */
export function toFormProp(
  ctx: ControlContext,
  data: Control<unknown>,
  expr: EntityExpression,
): FormProp<boolean> {
  switch (expr.type) {
    case "Data":
      return (rc) => !!rc.getValue(child(data, expr.field));
    case "NotEmpty":
      return (rc) =>
        isEmpty(rc.getValue(child(data, expr.field))) === !!expr.empty;
    case "DataMatch":
      return (rc) => rc.getValue(child(data, expr.field)) === expr.value;
    case "Jsonata":
      return jsonataProp(ctx, data, expr.expression);
  }
}

/**
 * Async, so the result lands in a control and the control *is* the prop.
 *
 * Cached on the data control's meta, keyed by the expression, because
 * **translation allocates**: a control plus a subscription per scripted prop.
 * Allocating during render worked until the component remounted, at which
 * point the demo ran 84,000 jsonata evaluations without a single warning —
 * see README finding 28. A JSX form allocates nothing per render and cannot
 * fail this way; a loader has to be built so it cannot either.
 */
function jsonataProp(
  ctx: ControlContext,
  data: Control<unknown>,
  expression: string,
): Control<boolean> {
  return ensureMetaValue<Control<boolean>>(
    data,
    "$expr/bool/" + expression,
    () => {
      const result = ctx.newControl(false);
      let expr: ReturnType<typeof jsonata> | undefined;
      try {
        expr = jsonata(expression);
      } catch {
        return result;
      }
      const run = () =>
        expr!
          .evaluate(untrackedRead.getValue(data) as object)
          .then((v) => ctx.update((wc) => wc.setValue(result, !!v)))
          .catch(() => ctx.update((wc) => wc.setValue(result, false)));
      data.subscribe(run, ControlChange.Value | ControlChange.Structure);
      run();
      return result;
    },
  );
}

/** The same, for an expression whose result is a value rather than a test. */
export function toValueProp(
  ctx: ControlContext,
  data: Control<unknown>,
  expr: EntityExpression,
): FormProp<unknown> {
  switch (expr.type) {
    case "Data":
      return (rc: ReadContext) => rc.getValue(child(data, expr.field));
    case "Jsonata":
      return ensureMetaValue<Control<unknown>>(
        data,
        "$expr/value/" + expr.expression,
        () => {
          const result = ctx.newControl<unknown>(undefined);
          let compiled: ReturnType<typeof jsonata> | undefined;
          try {
            compiled = jsonata(expr.expression);
          } catch {
            return result;
          }
          const run = () =>
            compiled!
              .evaluate(untrackedRead.getValue(data) as object)
              .then((v) => ctx.update((wc) => wc.setValue(result, v)))
              .catch(() => ctx.update((wc) => wc.setValue(result, undefined)));
          data.subscribe(run, ControlChange.Value | ControlChange.Structure);
          run();
          return result;
        },
      );
    default:
      return (rc: ReadContext) => !!getProp(rc, toFormProp(ctx, data, expr));
  }
}
