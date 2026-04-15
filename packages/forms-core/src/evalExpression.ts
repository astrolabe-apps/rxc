import {
  type Control,
  type ControlContext,
  effect,
} from "@rxc/controls-core";
import {
  type DataExpression,
  type DataMatchExpression,
  type EntityExpression,
  ExpressionType,
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
  { dataNode, returnResult, ctx, addCleanup },
) => {
  const ef = effect(ctx, (rc) => {
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
  { dataNode, returnResult, ctx, addCleanup },
) => {
  const ef = effect(ctx, (rc) => {
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
  { dataNode, returnResult, schemaInterface, ctx, addCleanup },
) => {
  const empty = !!expr.empty;
  const ef = effect(ctx, (rc) => {
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

/**
 * Registry of built-in expression evaluators. `Jsonata` is deferred — it
 * needs the `jsonata` package and is part of a follow-up layer.
 */
export const defaultEvaluators: Record<string, ExpressionEval<any>> = {
  [ExpressionType.Data]: dataEval,
  [ExpressionType.DataMatch]: dataMatchEval,
  [ExpressionType.NotEmpty]: notEmptyEval,
  [ExpressionType.UUID]: uuidEval,
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
