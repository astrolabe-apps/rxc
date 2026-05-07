"use client";

import type { ReadContext } from "@rxc/controls-core";
import {
  ExpressionType,
  type DataExpression,
  type EntityExpression,
  type FormStateNode,
} from "@rxc/forms-core";

/**
 * Read the value produced by an `EntityExpression` against a node's data
 * context.
 *
 * Phase 2: synchronous evaluation only — `Data` expressions resolve via
 * the data cursor relative to the node's parent. `Jsonata` and other
 * async expressions return `undefined` and will be handled in a later
 * phase that wires `forms-core`'s full evaluator infrastructure.
 *
 * Not a React hook (despite the name) — call from any rc-tracked render.
 */
export function useExpression(
  rc: ReadContext,
  node: FormStateNode,
  expr: EntityExpression | null | undefined,
): unknown {
  if (!expr?.type) return undefined;
  if (expr.type === ExpressionType.Data) {
    const path = (expr as DataExpression).field;
    const parent = node.parent;
    if (!parent) return undefined;
    let cursor = parent.cursor(rc);
    // Resolve `../field`-style paths
    const segments = path.split("/");
    for (const seg of segments) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") {
        if (!cursor.parent) return undefined;
        cursor = cursor.parent;
        continue;
      }
      const next = cursor.childField?.(seg);
      if (!next) return undefined;
      cursor = next;
    }
    const data = cursor.control;
    if (!data) return undefined;
    return rc.getValue(data);
  }
  // Other expression types (Jsonata, DataMatch, NotEmpty, UUID, Not) —
  // need the full forms-core evaluator. Phase 3 / 4b.
  return undefined;
}
