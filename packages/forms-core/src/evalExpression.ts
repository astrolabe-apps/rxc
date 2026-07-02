import {
  type Control,
  type ControlContext,
  effect,
  noopReadContext,
  type ReadContext,
} from "@rxc/controls-core";
import {
  SubscriptionReconciler,
  TrackingReadContext,
} from "@rxc/controls-core/internal";
import jsonata from "jsonata";
import {
  type DataExpression,
  type DataMatchExpression,
  type EntityExpression,
  ExpressionType,
  type JsonataExpression,
  type NotEmptyExpression,
  type NotExpression,
} from "./json";
import { dataRef } from "./cursorUtils";
import type { DataCursor, DataNode, VariablesFunc } from "./types";
import type { SchemaInterface } from "./schemaInterface";

// ── Context + types ───────────────────────────────────────────────

/**
 * Per-evaluation context handed to an {@link ExpressionEval}. The evaluator
 * registers reactive effects that recompute the expression as its inputs
 * change, publishing each result via `returnResult`. The caller owns the
 * {@link ControlContext} and a disposable `addCleanup` for any effects the
 * evaluator creates.
 */
export interface ExpressionEvalContext {
  /** Host control context — for creating controls and running updates. */
  ctx: ControlContext;
  /** Called whenever the evaluator produces a new result. */
  returnResult: (v: unknown) => void;
  /** Data context — the node the expression is evaluated against. */
  dataNode: DataNode;
  /** Schema-aware operations (empty-check, etc.). */
  schemaInterface: SchemaInterface;
  /** Variables hook (reserved for jsonata). */
  variables?: VariablesFunc;
  /** Runner for deferred/async work (reserved for jsonata). */
  runAsync: (fn: () => void) => void;
  /** Cleanup registration — called when the evaluator's effects should be disposed. */
  addCleanup(fn: () => void): void;
  /**
   * Optional gate — when supplied and reading `false`, the evaluator
   * publishes `undefined` and skips the actual evaluation. The reactive
   * read registers a dependency, so the evaluator re-runs when the gate
   * flips. Used by validators to suppress evaluation while the host
   * node is hidden.
   */
  isEnabled?: (rc: ReadContext) => boolean;
}

/** Evaluator function for a given {@link EntityExpression} kind. */
export type ExpressionEval<T extends EntityExpression> = (
  expr: T,
  context: ExpressionEvalContext,
) => void;

// ── Built-in evaluators ───────────────────────────────────────────

/**
 * `Data` expression — evaluates to the value of another field resolved
 * relative to the current data node via `/`-path navigation (`..` for parent,
 * `.` for self, field names for descent).
 */
const dataEval: ExpressionEval<DataExpression> = (
  expr,
  { dataNode, returnResult, ctx, addCleanup, isEnabled },
) => {
  const ef = effect(ctx, (rc) => {
    if (isEnabled && !isEnabled(rc)) {
      returnResult(undefined);
      return;
    }
    const other = dataRef(dataNode.cursor(rc), expr.field);
    returnResult(other ? rc.getValue(other.control) : undefined);
  });
  addCleanup(() => ef.cleanup());
};

/**
 * `DataMatch` (a.k.a. `FieldValue`) — `true` iff the referenced field
 * equals (or, for array fields, contains) the given value.
 */
const dataMatchEval: ExpressionEval<DataMatchExpression> = (
  expr,
  { dataNode, returnResult, ctx, addCleanup, isEnabled },
) => {
  const ef = effect(ctx, (rc) => {
    if (isEnabled && !isEnabled(rc)) {
      returnResult(undefined);
      return;
    }
    const other = dataRef(dataNode.cursor(rc), expr.field);
    if (!other) {
      returnResult(false);
      return;
    }
    const v = rc.getValue(other.control);
    returnResult(Array.isArray(v) ? v.includes(expr.value) : v === expr.value);
  });
  addCleanup(() => ef.cleanup());
};

/**
 * `NotEmpty` — `true` iff `empty === schemaInterface.isEmptyValue(field, v)`.
 * With `empty` unset or falsy, this is "the referenced field is not empty".
 */
const notEmptyEval: ExpressionEval<NotEmptyExpression> = (
  expr,
  { dataNode, returnResult, schemaInterface, ctx, addCleanup, isEnabled },
) => {
  const empty = !!expr.empty;
  const ef = effect(ctx, (rc) => {
    if (isEnabled && !isEnabled(rc)) {
      returnResult(undefined);
      return;
    }
    const other = dataRef(dataNode.cursor(rc), expr.field);
    if (!other) {
      returnResult(false);
      return;
    }
    const v = rc.getValue(other.control);
    returnResult(empty === schemaInterface.isEmptyValue(other.field, v));
  });
  addCleanup(() => ef.cleanup());
};

/**
 * `UUID` — emits a freshly-generated UUID once. Non-reactive — the value
 * is produced during registration. Uses `crypto.randomUUID` (available in
 * modern browsers, Node 14.17+, and the forms-core test environment).
 */
const uuidEval: ExpressionEval<EntityExpression> = (_, { returnResult }) => {
  returnResult(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : fallbackUuid(),
  );
};

/** Tiny RFC-4122-v4 fallback for environments without `crypto.randomUUID`. */
function fallbackUuid(): string {
  const b = new Array<number>(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
    .slice(6, 8)
    .join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
}

// ── Jsonata evaluator ─────────────────────────────────────────────

interface PathSegment {
  key: string | number;
  collection: boolean;
}

/**
 * Collect path segments from the data tree root down to (but excluding)
 * the root node itself — one entry per named field or array-element hop.
 * Each segment carries the key (field name or element index) and whether
 * the field is a collection.
 *
 * Path is resolved as a snapshot (`noopReadContext`) — jsonata bindings are
 * structural, not reactive w.r.t. the schema itself. For the editor-mode
 * reactive-schema use case this can be revisited.
 */
function getSchemaPath(dataNode: DataNode): PathSegment[] {
  const out: PathSegment[] = [];
  let cur: DataNode | undefined = dataNode;
  while (cur && cur.parent) {
    const cursor = cur.cursor(noopReadContext);
    out.push({
      key: cursor.elementIndex ?? cursor.field.field,
      collection: !!cursor.field.collection,
    });
    cur = cur.parent;
  }
  return out.reverse();
}

/**
 * Format a JSON-path array for the jsonata prefix. Field names are
 * separated by `.`; numeric indices use `customIndex(x)` (or `[x]` by
 * default). Matches the legacy `jsonPathString` output.
 */
function jsonPathString(
  jsonPath: (string | number)[],
  customIndex?: (n: number) => string,
): string {
  let out = "";
  jsonPath.forEach((v, i) => {
    if (typeof v === "number") {
      out += customIndex?.(v) ?? "[" + v + "]";
    } else {
      if (i > 0) out += ".";
      out += v;
    }
  });
  return out;
}

/**
 * Wrap `data` in a proxy that substitutes an empty object/array for any
 * null value encountered along `path`. Mirrors the legacy
 * `ensurePathNavigable` helper — jsonata cannot traverse null compound
 * values (see jsonata issue #773), so we inject empties along the known
 * path while leaving the rest of the tree untouched.
 *
 * Preserves the navigation chain by returning a fresh wrapping proxy at
 * every hop, so the `%` parent operator continues to work inside the
 * jsonata expression.
 */
function ensurePathNavigable(data: any, path: PathSegment[]): any {
  if (path.length === 0 || data == null || typeof data !== "object")
    return data;
  const { key, collection } = path[0];
  const segment = String(key);
  const rest = path.slice(1);
  return new Proxy(data, {
    get(target, p, receiver) {
      const val = Reflect.get(target, p, receiver);
      if (typeof p === "string" && p === segment) {
        if (val == null) return ensurePathNavigable(collection ? [] : {}, rest);
        return ensurePathNavigable(val, rest);
      }
      return val;
    },
  });
}

/** Walk up to the root of the data-node tree. */
function getRootDataNode(dataNode: DataNode): DataNode {
  let cur = dataNode;
  while (cur.parent) cur = cur.parent;
  return cur;
}

/**
 * `Jsonata` expression — async. Binds the expression to the current data
 * node's path and evaluates against the root data tree. Re-runs whenever
 * a tracked dependency (any value read by jsonata during evaluation)
 * changes.
 *
 * The evaluator uses its own {@link TrackingReadContext} +
 * {@link SubscriptionReconciler} because jsonata's `.evaluate()` is async
 * and reads happen lazily through the data proxy during evaluation —
 * `effect`'s synchronous reconciliation cycle doesn't capture those.
 *
 * Concurrency: a change during evaluation aborts the in-flight result
 * and queues a fresh run; the aborted result is discarded.
 *
 * Variables: the {@link VariablesFunc} is invoked with the same
 * `TrackingReadContext` used to read the data tree, so any reactive
 * reads it performs (e.g. exposing `optionSelected` based on the current
 * data control value) trigger re-evaluation when their inputs change.
 */
const jsonataEvalImpl: ExpressionEval<JsonataExpression> = (
  expr,
  { dataNode, returnResult, variables, runAsync, addCleanup, isEnabled },
) => {
  const pathSegments = getSchemaPath(dataNode);
  const path = pathSegments.map((s) => s.key);
  const pathString = jsonPathString(path, (x) => `#$i[${x}]`);
  const jExpr = expr.expression;
  const fullExpr = pathString ? `${pathString}.(${jExpr})` : jExpr;

  let parsed: jsonata.Expression;
  try {
    parsed = jsonata(fullExpr || "null");
  } catch (e) {
    console.error(`Failed to parse jsonata expression: ${fullExpr}`, e);
    parsed = jsonata("null");
  }

  const rootControl = getRootDataNode(dataNode).cursor(noopReadContext).control;

  const rc = new TrackingReadContext();
  const reconciler = new SubscriptionReconciler();

  let destroyed = false;
  let running = false;
  let pendingRun = false;
  let scheduled = false;
  let aborter: AbortController | undefined;

  const schedule = () => {
    if (scheduled || destroyed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (destroyed) return;
      runNow();
    });
  };

  reconciler.setListener(() => {
    if (destroyed) return;
    if (running) {
      aborter?.abort();
      pendingRun = true;
      return;
    }
    schedule();
  });

  function runNow() {
    if (destroyed) return;
    if (running) {
      aborter?.abort();
      pendingRun = true;
      return;
    }
    running = true;
    aborter = new AbortController();
    const signal = aborter.signal;
    rc.reset();

    // Optional gate — when disabled, skip the actual evaluation. The
    // `isEnabled` read registers a dependency, so flipping it back
    // schedules a re-run via the reconciler.
    if (isEnabled && !isEnabled(rc)) {
      reconciler.reconcile(rc.tracked);
      returnResult(undefined);
      running = false;
      aborter = undefined;
      return;
    }

    const trackedVars = variables?.(rc);
    const data = ensurePathNavigable(
      rc.getValueRx(rootControl),
      pathSegments,
    );

    parsed
      .evaluate(data, trackedVars)
      .then((result: unknown) => {
        if (destroyed || signal.aborted) return;
        reconciler.reconcile(rc.tracked);
        returnResult(result);
      })
      .catch((e: unknown) => {
        if (destroyed || signal.aborted) return;
        console.error(`Error in jsonata expression: ${fullExpr}`, e);
        reconciler.reconcile(rc.tracked);
        returnResult(undefined);
      })
      .finally(() => {
        running = false;
        aborter = undefined;
        if (pendingRun && !destroyed) {
          pendingRun = false;
          schedule();
        }
      });
  }

  runAsync(() => runNow());

  addCleanup(() => {
    destroyed = true;
    aborter?.abort();
    reconciler.cleanup();
  });
};

/** Exported for use by `jsonataValidator` in `validators.ts`. */
export const jsonataEval = jsonataEvalImpl;

/**
 * Registry of built-in expression evaluators.
 */
export const defaultEvaluators: Record<string, ExpressionEval<any>> = {
  [ExpressionType.Data]: dataEval,
  [ExpressionType.DataMatch]: dataMatchEval,
  [ExpressionType.NotEmpty]: notEmptyEval,
  [ExpressionType.UUID]: uuidEval,
  [ExpressionType.Jsonata]: jsonataEvalImpl,
};

// ── createEvalExpr ────────────────────────────────────────────────

/**
 * The lowest-level evaluator hook used by the scripted-proxy machinery.
 * Given a target override {@link Control} and an {@link EntityExpression},
 * wires up reactive effects that keep the target control in sync with
 * the expression's current value.
 *
 * - Initializes the target to `init` immediately.
 * - Unwraps any {@link NotExpression} layers, inverting `coerce` on each
 *   level so the final coercion matches the wrapped expression's result.
 * - Returns `true` iff an expression actually got registered.
 */
export type EvalExpr = <A>(
  init: A,
  target: Control<A>,
  expr: EntityExpression | undefined,
  coerce: (r: unknown) => any,
  addCleanup: (fn: () => void) => void,
) => boolean;

export function createEvalExpr(
  dispatch: (expr: EntityExpression, ctx: ExpressionEvalContext) => void,
  base: Omit<ExpressionEvalContext, "returnResult" | "addCleanup">,
): EvalExpr {
  return <A>(
    init: A,
    target: Control<A>,
    expr: EntityExpression | undefined,
    coerce: (r: unknown) => any,
    addCleanup: (fn: () => void) => void,
  ): boolean => {
    base.ctx.update((wc) => wc.setValue(target, init));
    if (!expr?.type) return false;

    // Unwrap Not layers — each level inverts the previous coercion. This
    // lets any evaluator work under a Not wrapper.
    let actualExpr: EntityExpression = expr;
    let actualCoerce = coerce;
    while (actualExpr?.type === ExpressionType.Not) {
      const inner = (actualExpr as NotExpression).innerExpression;
      if (!inner) break;
      const prev = actualCoerce;
      actualCoerce = (r) => prev(!r);
      actualExpr = inner;
    }
    if (!actualExpr?.type) return false;

    dispatch(actualExpr, {
      ...base,
      addCleanup,
      returnResult: (r) => {
        base.ctx.update((wc) => wc.setValue(target, actualCoerce(r)));
      },
    });
    return true;
  };
}
