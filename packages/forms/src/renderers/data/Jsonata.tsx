"use client";

import { useMemo } from "react";
import { controls } from "@rxc/controls";
import {
  ExpressionType,
  isDataControl,
  type JsonataExpression,
  type JsonataRenderOptions,
} from "@rxc/forms-core";
import {
  rendererClass,
  useExpression,
  type DataRendererProps,
} from "@rxc/forms-react-core";

/**
 * Render a Jsonata expression result as HTML.
 *
 * The expression is read from `renderOptions.expression` on the data
 * control definition. Evaluation is async + reactive — re-runs whenever
 * any tracked input changes — and the latest string result is injected
 * into the DOM via `dangerouslySetInnerHTML`.
 *
 * Hosts that need to escape arbitrary HTML before rendering should
 * either sanitize on the data side or replace this renderer with a
 * text-only equivalent.
 */
export const JsonataRenderer = controls<DataRendererProps>(
  "JsonataRenderer",
  ({ node, id }, { rc }) => {
    const { definition } = node.getState(rc);
    const renderOptions = isDataControl(definition)
      ? (definition.renderOptions as JsonataRenderOptions | undefined)
      : undefined;
    const expression = renderOptions?.expression ?? "";
    // Stable reference — evaluator is keyed on identity, so we only want
    // to re-register when the expression string actually changes.
    const expr = useMemo<JsonataExpression>(
      () => ({ type: ExpressionType.Jsonata, expression }),
      [expression],
    );
    const result = useExpression(rc, node, expr);
    const html = result == null ? "" : String(result);
    const className = rendererClass(definition.styleClass, undefined);
    return (
      <div
        id={id}
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
);
