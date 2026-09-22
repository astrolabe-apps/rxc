import jsonata from "jsonata";
import type { Control, ControlContext, ReadContext } from "@rx-controls/core";
import { ensureMetaValue } from "@rx-controls/core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rx-controls/core/internal";
import { getProp, type FormProp, type Validator } from "../framework/index.js";
import type { EntityExpression } from "./json.js";
import {
  ensurePathNavigable,
  jsonataPrefix,
  resolveRef,
  rootOf,
  type DataScope,
} from "./scope.js";

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
/**
 * Reported back to the loader rather than logged. Only a *compile* failure and
 * an unresolvable reference can be — both happen while the expression is being
 * turned into a prop, which is translate time. An evaluation that throws later
 * does so asynchronously, long after the warning list has been handed over,
 * and stays a silent `false`.
 */
export type ExprWarn = (detail: string) => void;

/** A referenced field's reader, or a constant `undefined` when the reference walks off the tree. */
function refReader(
  scope: DataScope,
  field: string,
  warn?: ExprWarn,
): (rc: ReadContext) => unknown {
  const r = resolveRef(scope, field);
  if (!r) {
    warn?.(`field reference "${field}" does not resolve from here`);
    return () => undefined;
  }
  const c = r.control;
  return (rc) => rc.getValue(c);
}

export function toFormProp(
  ctx: ControlContext,
  scope: DataScope,
  expr: EntityExpression,
  warn?: ExprWarn,
): FormProp<boolean> {
  switch (expr.type) {
    case "Data": {
      const read = refReader(scope, expr.field, warn);
      return (rc) => !!read(rc);
    }
    case "NotEmpty": {
      const read = refReader(scope, expr.field, warn);
      return (rc) => isEmpty(read(rc)) === !!expr.empty;
    }
    case "DataMatch": {
      const read = refReader(scope, expr.field, warn);
      return (rc) => read(rc) === expr.value;
    }
    case "Jsonata":
      return jsonataProp(ctx, scope, expr.expression, warn);
  }
}

/** The same, for an expression whose result is a value rather than a test. */
export function toValueProp(
  ctx: ControlContext,
  scope: DataScope,
  expr: EntityExpression,
  warn?: ExprWarn,
): FormProp<unknown> {
  switch (expr.type) {
    case "Data":
      return refReader(scope, expr.field, warn);
    case "Jsonata":
      return jsonataValue(ctx, scope, expr.expression, warn);
    default: {
      const p = toFormProp(ctx, scope, expr, warn);
      return (rc: ReadContext) => !!getProp(rc, p);
    }
  }
}

/**
 * Compile with legacy's prefix — `pets#$i[2].(expr)` — so the scope's data is
 * the expression's context, `$$` is the form's root and `$i` the row index.
 * The corpus leans on all three: 50 of its 418 jsonata expressions sit inside
 * array rows, 10 read `$i`, 5 read `$$`.
 */
function compile(
  scope: DataScope,
  expression: string,
  warn?: ExprWarn,
): jsonata.Expression | undefined {
  const prefix = jsonataPrefix(scope.path);
  const full = prefix ? `${prefix}.(${expression})` : expression;
  try {
    return jsonata(full);
  } catch (e) {
    warn?.(`jsonata expression does not compile: ${expression} (${e})`);
    return undefined;
  }
}

/**
 * Evaluate against the **root** through a tracked proxy, so exactly what the
 * expression touches — `$$.other` included — re-runs it, and nothing else
 * does. Legacy's model. The previous cut evaluated against the parent value
 * and subscribed to the whole of it: too coarse, and wrong under `$$`, which
 * then meant the parent rather than the root. Jsonata reads lazily, so the
 * window closes when the evaluation settles, not when it starts; a change
 * that lands mid-evaluation supersedes the result.
 */
function evaluator(
  scope: DataScope,
  compiled: jsonata.Expression,
  onResult: (v: unknown) => void,
  onError: (e: unknown) => void,
): { run(): void } {
  const root = rootOf(scope).control;
  const path = scope.path;
  const rc = new TrackingReadContext();
  const reconciler = new SubscriptionReconciler();
  let gen = 0;
  const run = () => {
    const id = ++gen;
    rc.beginTracking();
    const data = ensurePathNavigable(rc.getTrackedValue(root), path);
    const settle = () => {
      reconciler.reconcile(rc.tracked);
      rc.finalize();
    };
    compiled.evaluate(data).then(
      (v: unknown) => {
        if (id !== gen) return;
        settle();
        onResult(v);
      },
      (e: unknown) => {
        if (id !== gen) return;
        settle();
        onError(e);
      },
    );
  };
  reconciler.setListener(run);
  return { run };
}

/**
 * Async, so the result lands in a control and the control *is* the prop.
 *
 * Cached on the scope's control's meta, keyed by the expression, because
 * **translation allocates**: a control plus a subscription per scripted prop.
 * Allocating during render worked until the component remounted, at which
 * point the demo ran 84,000 jsonata evaluations without a single warning —
 * see README finding 28. A JSX form allocates nothing per render and cannot
 * fail this way; a loader has to be built so it cannot either. A row's scope
 * control is the row, so a per-row expression is cached per row.
 */
function jsonataProp(
  ctx: ControlContext,
  scope: DataScope,
  expression: string,
  warn?: ExprWarn,
): Control<boolean> {
  return ensureMetaValue<Control<boolean>>(
    scope.control,
    "$expr/bool/" + expression,
    () => {
      const result = ctx.newControl(false);
      const compiled = compile(scope, expression, warn);
      if (!compiled) return result;
      evaluator(
        scope,
        compiled,
        (v) => ctx.update((wc) => wc.setValue(result, !!v)),
        () => ctx.update((wc) => wc.setValue(result, false)),
      ).run();
      return result;
    },
  );
}

function jsonataValue(
  ctx: ControlContext,
  scope: DataScope,
  expression: string,
  warn?: ExprWarn,
): Control<unknown> {
  return ensureMetaValue<Control<unknown>>(
    scope.control,
    "$expr/value/" + expression,
    () => {
      const result = ctx.newControl<unknown>(undefined);
      const compiled = compile(scope, expression, warn);
      if (!compiled) return result;
      evaluator(
        scope,
        compiled,
        (v) => ctx.update((wc) => wc.setValue(result, v)),
        () => ctx.update((wc) => wc.setValue(result, undefined)),
      ).run();
      return result;
    },
  );
}

/**
 * A legacy `Jsonata` validator: the expression yields the message, or nothing.
 * Same prefix and root as the props above, so `$$` and `$i` mean the same in
 * a validator as in a `Visible`. `null`/`undefined` is "valid"; anything else
 * is stringified, legacy's rule.
 *
 * The dependency is the whole root, read eagerly, because a validator's
 * tracking window closes when the function returns (§5) and jsonata reads
 * lazily after that. Coarse — any edit re-runs every jsonata validator on the
 * form — but correct, and 45 validators corpus-wide is not where the cost is.
 */
export function jsonataValidator(
  scope: DataScope,
  expression: string,
  warn?: ExprWarn,
): Validator<unknown> | undefined {
  const compiled = compile(scope, expression, warn);
  if (!compiled) return undefined;
  const root = rootOf(scope).control;
  const path = scope.path;
  return (_value, rc) => {
    const input = ensurePathNavigable(rc.getValue(root), path);
    return compiled.evaluate(input).then(
      (v: unknown) => (v == null ? null : String(v)),
      (e: unknown) => {
        warn?.(`jsonata validator failed: ${expression} (${e})`);
        return null;
      },
    );
  };
}
