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
): FormProp<boolean | undefined> | undefined {
  switch (expr.type) {
    case "Data": {
      const read = refReader(scope, expr.field as string, warn);
      return (rc) => !!read(rc);
    }
    case "NotEmpty": {
      const read = refReader(scope, expr.field as string, warn);
      // Read now, not in the closure: the loader's audit runs at translate
      // time, and a property first read on evaluation counts as dropped.
      const empty = !!expr.empty;
      return (rc) => isEmpty(read(rc)) === empty;
    }
    case "DataMatch":
    case "FieldValue": {
      // `FieldValue` is what the server writes for `DataMatch`. The loader
      // had no case for it and no default, so 296 Visible / Disabled
      // conditions were silently static until the audit saw their `field`
      // and `value` go unread (README finding 62).
      const e = expr as { field: string; value: unknown };
      const read = refReader(scope, e.field, warn);
      const value = e.value;
      return (rc) => read(rc) === value;
    }
    case "Jsonata":
      return jsonataProp(ctx, scope, expr.expression as string, warn);
    default:
      warn?.(
        `expression kind "${String((expr as { type?: unknown }).type ?? "(none)")}" is not supported — the value stays static`,
      );
      return undefined;
  }
}

/** The same, for an expression whose result is a value rather than a test. */
export function toValueProp(
  ctx: ControlContext,
  scope: DataScope,
  expr: EntityExpression,
  warn?: ExprWarn,
): FormProp<unknown> | undefined {
  switch (expr.type) {
    case "Data":
      return refReader(scope, expr.field as string, warn);
    case "Jsonata":
      return jsonataValue(ctx, scope, expr.expression as string, warn);
    default: {
      const p = toFormProp(ctx, scope, expr, warn);
      return p && ((rc: ReadContext) => !!getProp(rc, p));
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
  // The corpus has one of these: an `AllowedOptions` whose expression was
  // never filled in. Report it as what it is, not as a compiler TypeError.
  if (!expression || !expression.trim()) {
    warn?.("jsonata expression is empty");
    return undefined;
  }
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
    // Bindings read through the same tracking rc, so `$formData.optionSelected`
    // re-runs the expression when the option's field changes.
    const bindings = scope.variables?.(rc);
    const settle = () => {
      reconciler.reconcile(rc.tracked);
      rc.finalize();
    };
    compiled.evaluate(data, bindings).then(
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
): Control<boolean | undefined> {
  return ensureMetaValue<Control<boolean | undefined>>(
    scope.control,
    "$expr/bool/" + (scope.cacheKey ?? "") + expression,
    () => {
      // `undefined` until the first evaluation lands: **pending is not
      // false**. Initialised to `false`, a `Visible` expression read as
      // hidden for one tick at mount, `clearHidden` wiped the value, and
      // by the time the expression said "shown" the data was gone. Legacy
      // keeps visibility `null` while an async script is pending and
      // suspends both cycles; the parity run found this on 200-odd fields
      // (README finding 66).
      const result = ctx.newControl<boolean | undefined>(undefined);
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
    "$expr/value/" + (scope.cacheKey ?? "") + expression,
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

/**
 * Legacy's `Date` validator (`forms-core` `evalDateValidator`), as a sync
 * `Validator`: the comparison instant is `fixedDate`, or today's local date
 * at UTC midnight plus `daysFromCurrent` days — fixed when the definition is
 * translated, as legacy fixed it when the node was created. A non-empty
 * value is parsed as the display formatter parses it (a naive date-time is
 * UTC) and fails `NotBefore` if earlier, `NotAfter` if later; the message is
 * legacy's, `toDateString()` and all. 11 uses in the corpus, every one an
 * offset from today (README finding 68).
 */
export function dateValidator(v: {
  comparison?: string;
  fixedDate?: string;
  daysFromCurrent?: number;
}): Validator<unknown> {
  const notAfter = v.comparison === "NotAfter";
  let comparison: number;
  if (v.fixedDate) comparison = parseToMillis(v.fixedDate);
  else {
    const now = new Date();
    comparison = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    if (v.daysFromCurrent) comparison += v.daysFromCurrent * 86400000;
  }
  return (value) => {
    if (!value) return null;
    const sel = parseToMillis(String(value));
    if (notAfter ? sel > comparison : sel < comparison)
      return `Date must not be ${notAfter ? "after" : "before"} ${new Date(comparison).toDateString()}`;
    return null;
  };
}

/** `DefaultSchemaInterface.parseToMillis`: a naive date-time is UTC. */
function parseToMillis(s: string): number {
  const hasTime = s.includes("T");
  const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(s);
  return new Date(hasTime && !hasZone ? s + "Z" : s).getTime();
}
