import {
  type Control,
  type ControlContext,
  effect,
  type ReadContext,
} from "@rxc/controls-core";
import {
  type ControlDefinition,
  DateComparison,
  type DateValidator,
  ExpressionType,
  isDataControl,
  isDisplayOnlyRenderer,
  type JsonataValidator,
  type LengthValidator,
  type SchemaValidator,
  ValidationMessageType,
  ValidatorType,
} from "./json";
import type {
  DataCursor,
  DataNode,
  FormNodeOptions,
  VariablesFunc,
} from "./types";
import type { SchemaInterface } from "./schemaInterface";
import { jsonataEval } from "./evalExpression";

/**
 * Context handed to each {@link ValidatorEval} while the node's validators
 * are being registered. Validators register sync checks via `addSync` and
 * disposable resources via `addCleanup`. The host uses `validationEnabled`
 * to gate whether errors get published (tied to `visible`).
 */
export interface ValidationEvalContext {
  /** Register a synchronous validator — returns an error string, `null`, or `undefined`. */
  addSync(validate: (value: unknown) => string | undefined | null): void;
  /** Register a teardown callback invoked when the validator set is rebuilt. */
  addCleanup(cleanup: () => void): void;
  /** Live flag — `true` iff the node is currently visible. */
  validationEnabled: Control<boolean>;
  /** Parent data cursor — used by validators that reference sibling fields. */
  parentData: DataCursor;
  /** Data cursor for the node under validation. */
  data: DataCursor;
  /** Schema-aware operations (length, message text, date parsing, ...). */
  schemaInterface: SchemaInterface;
  /** Variables hook forwarded to expression-based validators (jsonata). */
  variables?: VariablesFunc;
  /** Runner for async validator work. */
  runAsync: (af: () => void) => void;
  /** Control context — used by validators that need to write (e.g. auto-pad). */
  ctx: ControlContext;
}

/** Registration function for a validator kind. */
export type ValidatorEval<T extends SchemaValidator> = (
  validation: T,
  context: ValidationEvalContext,
) => void;

// ── Built-in validator evaluators ─────────────────────────────────

/**
 * Length validator — enforces `min` and `max` bounds on the field's value.
 *
 * Preserves the old behaviour of auto-padding a collection with `undefined`
 * entries to reach `min` (rather than reporting an error). This is a
 * side-effectful validator but matches the settled semantics.
 */
const evalLengthValidator: ValidatorEval<LengthValidator> = (lv, context) => {
  const { schemaInterface, data, ctx } = context;
  context.addSync(() => {
    const field = data.field;
    const control = data.control;
    const len = schemaInterface.controlLength(field, control);
    if (lv.min != null && len < lv.min) {
      if (field.collection) {
        const min = lv.min;
        ctx.update((wc) => {
          wc.updateValue(control as Control<unknown[]>, (v) =>
            Array.isArray(v)
              ? v.concat(Array.from({ length: min - v.length }))
              : Array.from({ length: min }),
          );
        });
        return undefined;
      }
      return schemaInterface.validationMessageText(
        field,
        ValidationMessageType.MinLength,
        len,
        lv.min,
      );
    }
    if (lv.max != null && len > lv.max) {
      return schemaInterface.validationMessageText(
        field,
        ValidationMessageType.MaxLength,
        len,
        lv.max,
      );
    }
    return undefined;
  });
};

/**
 * Date validator — enforces `NotBefore` / `NotAfter` comparisons against a
 * fixed date or an offset from today.
 */
const evalDateValidator: ValidatorEval<DateValidator> = (dv, context) => {
  const { schemaInterface, data } = context;
  const field = data.field;
  let comparisonDate: number;
  if (dv.fixedDate) {
    comparisonDate = schemaInterface.parseToMillis(field, dv.fixedDate);
  } else {
    const nowDate = new Date();
    comparisonDate = Date.UTC(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
    );
    if (dv.daysFromCurrent) {
      comparisonDate += dv.daysFromCurrent * 86400000;
    }
  }
  context.addSync((v) => {
    if (v) {
      const selDate = schemaInterface.parseToMillis(field, v as string);
      const notAfter = dv.comparison === DateComparison.NotAfter;
      if (notAfter ? selDate > comparisonDate : selDate < comparisonDate) {
        return schemaInterface.validationMessageText(
          field,
          notAfter
            ? ValidationMessageType.NotAfterDate
            : ValidationMessageType.NotBeforeDate,
          selDate,
          comparisonDate,
        );
      }
    }
    return null;
  });
};

/**
 * Jsonata validator — evaluates `expression` against the parent data
 * context and publishes the stringified result as an error under the
 * `"jsonata"` key. A null/undefined result clears the error; a non-null
 * falsy result (e.g. `""`) is normalised to no-error by the Control.
 *
 * Errors are only published while `validationEnabled` is true, matching
 * the general "invisible fields don't report errors" semantics.
 */
const evalJsonataValidator: ValidatorEval<JsonataValidator> = (
  validation,
  context,
) => {
  const {
    ctx,
    data,
    parentData,
    validationEnabled,
    schemaInterface,
    variables,
    runAsync,
    addCleanup,
  } = context;

  const resultControl = ctx.newControl<unknown>(undefined);

  // Publisher effect: republishes the error whenever the async result or
  // `validationEnabled` changes.
  const publisher = effect(ctx, (rc) => {
    const enabled = rc.getValue(validationEnabled);
    const result = rc.getValue(resultControl);
    const errStr = enabled
      ? result == null
        ? null
        : String(result)
      : null;
    ctx.update((wc) => wc.setError(data.control, "jsonata", errStr));
  });
  addCleanup(() => publisher.cleanup());

  jsonataEval(
    { type: ExpressionType.Jsonata, expression: validation.expression },
    {
      ctx,
      dataNode: parentData.node,
      schemaInterface,
      variables,
      runAsync,
      returnResult: (v) => {
        ctx.update((wc) => wc.setValue(resultControl, v));
      },
      addCleanup,
    },
  );

  addCleanup(() => {
    ctx.update((wc) => wc.setError(data.control, "jsonata", null));
  });
};

/**
 * Registry of built-in validator kinds.
 */
export const defaultValidators: Record<string, ValidatorEval<any>> = {
  [ValidatorType.Length]: evalLengthValidator,
  [ValidatorType.Date]: evalDateValidator,
  [ValidatorType.Jsonata]: evalJsonataValidator,
};

/**
 * Collect the sync validators for a {@link ControlDefinition} into the given
 * {@link ValidationEvalContext}. Handles:
 *
 * - `required`: reports `NotEmpty` when the value is empty (except for
 *   display-only renderers, which ignore `required`).
 * - `validators[]`: dispatches each to the matching evaluator in
 *   {@link defaultValidators}; unknown kinds are ignored.
 */
export function createValidators(
  def: ControlDefinition,
  context: ValidationEvalContext,
): void {
  if (!isDataControl(def)) return;
  const { schemaInterface } = context;
  if (def.required && !isDisplayOnlyRenderer(def.renderOptions)) {
    context.addSync((v) => {
      const field = context.data.field;
      return schemaInterface.isEmptyValue(field, v)
        ? (def.requiredErrorText ??
            schemaInterface.validationMessageText(
              field,
              ValidationMessageType.NotEmpty,
              false,
              true,
            ))
        : null;
    });
  }
  def.validators?.forEach((x) => defaultValidators[x.type]?.(x, context));
}

// ── Wiring ────────────────────────────────────────────────────────

/**
 * Per-FormStateNode accessor shape — the subset of
 * {@link FormStateNode}-impl state that {@link setupValidation} needs.
 */
export interface ValidationHostInternals {
  ctx: ControlContext;
  uniqueId: string;
  schemaInterface: SchemaInterface;
  parentDataNode: DataNode;
  dataNodeControl: Control<DataNode | undefined>;
  visibleControl: Control<boolean | null>;
  nodeOptionsControl: Control<FormNodeOptions>;
  runAsync: (af: () => void) => void;
  addCleanup(fn: () => void): void;
}

/**
 * Install validation effects on a FormStateNode.
 *
 * The top-level effect re-runs when the data binding changes — on each run
 * it tears down the previous validator set and registers a fresh one for
 * the new data cursor. The inner effect runs on every value change and
 * publishes a single aggregated error under `uniqueId + "default"`.
 *
 * Errors are only published when `validationEnabled` (= `!!visible`) is
 * true, matching the old semantics that invisible fields don't report
 * errors.
 */
export function setupValidation(
  host: ValidationHostInternals,
  defFor: (rc: ReadContext) => ControlDefinition,
): void {
  const {
    ctx,
    uniqueId,
    schemaInterface,
    parentDataNode,
    dataNodeControl,
    visibleControl,
    nodeOptionsControl,
    runAsync,
  } = host;

  const validationEnabled = ctx.newControl(false);
  const enabledEffect = effect(ctx, (rc) => {
    const vis = rc.getValue(visibleControl);
    ctx.update((wc) => wc.setValue(validationEnabled, !!vis));
  });
  host.addCleanup(() => enabledEffect.cleanup());

  const errorKey = uniqueId + "default";

  const outer = effect(ctx, (rc) => {
    const dn = rc.getValue(dataNodeControl);
    if (!dn) return;
    const definition = defFor(rc);
    const dataCursor = dn.cursor(rc);
    const parentCursor = parentDataNode.cursor(rc);

    const syncValidations: ((v: unknown) => string | undefined | null)[] = [];
    const innerCleanups: (() => void)[] = [];
    createValidators(definition, {
      data: dataCursor,
      parentData: parentCursor,
      validationEnabled,
      schemaInterface,
      addSync: (v) => syncValidations.push(v),
      addCleanup: (c) => innerCleanups.push(c),
      variables: rc.getValue(nodeOptionsControl).variables,
      runAsync,
      ctx,
    });

    // Resolve the data control once (snapshot) — it is stable for the
    // lifetime of this outer effect run, so the inner effect can close
    // over it directly without re-resolving each tick.
    const control = dataCursor.control;

    const inner = effect(ctx, (rc2) => {
      const enabled = rc2.getValue(validationEnabled);
      if (!enabled) {
        ctx.update((wc) => wc.setError(control, errorKey, null));
        return;
      }
      const value = rc2.getValue(control);
      let error: string | null | undefined = null;
      for (const sync of syncValidations) {
        error = sync(value);
        if (error) break;
      }
      ctx.update((wc) => wc.setError(control, errorKey, error));
    });

    return () => {
      inner.cleanup();
      for (const c of innerCleanups) c();
      // Clear any residual error so rebuilding validators doesn't leave
      // a stale message attached to the data control.
      ctx.update((wc) => wc.setError(control, errorKey, null));
    };
  });
  host.addCleanup(() => outer.cleanup());
}
