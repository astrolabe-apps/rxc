import type { Control } from "@rxc/controls-core";
import {
  FieldType,
  type FieldOption,
  type SchemaField,
  ValidationMessageType,
} from "./json";
import type { DataCursor, SchemaCursor } from "./types";

/**
 * Schema-aware operations needed by form state computation and renderers.
 *
 * Layer-2 subset — the old `astrolabe-common` `SchemaInterface` has many
 * more methods (text formatting, validation messages, date parsing, control
 * setup). Those will land with the renderer (Layer 4+) and validation
 * (Layer 3) work; only the handful that `FormStateNode` actually needs in
 * Layer 2 are defined here.
 */
export interface SchemaInterface {
  /**
   * Whether the given value is considered "empty" for this field type.
   * Drives the `hideDisplayOnly` visibility rule (empty display-only
   * fields with no `emptyText` are hidden).
   */
  isEmptyValue(field: SchemaField, value: unknown): boolean;

  /**
   * Resolve the canonical options list for a raw {@link SchemaField}.
   * Returns `null` when the field has no options, matching the old API.
   */
  getOptions(field: SchemaField): FieldOption[] | null | undefined;

  /**
   * Resolve options for a {@link SchemaCursor} — override to do schema-aware
   * computations (e.g. option pools depending on ancestor schema state).
   */
  getNodeOptions(cursor: SchemaCursor): FieldOption[] | null | undefined;

  /**
   * Resolve options for a {@link DataCursor} — override to do data-aware
   * computations (e.g. filtered option sets depending on sibling values).
   */
  getDataOptions(cursor: DataCursor): FieldOption[] | null | undefined;

  /**
   * Compare two values under this field's type. Returns a standard sort
   * number; `0` when equal. Used for option-selection equality tests.
   */
  compareValue(field: SchemaField, v1: unknown, v2: unknown): number;

  /**
   * Length of the value held in a {@link Control}. For collection fields,
   * returns `control.elements.length`; for scalars, delegates to
   * {@link valueLength}. Used by the `Length` validator.
   *
   * Snapshot read — validation effects register their own reactive deps
   * elsewhere; callers inside a reactive scope should ensure they track
   * the control value by other means.
   */
  controlLength(field: SchemaField, control: Control<unknown>): number;

  /**
   * Length of a raw value. Defaults to `value.length` when a `length`
   * property exists, else `0`.
   */
  valueLength(field: SchemaField, value: unknown): number;

  /**
   * Human-readable error text for a validation failure. Called by the
   * built-in `required` / `Length` / `Date` validators.
   */
  validationMessageText(
    field: SchemaField,
    messageType: ValidationMessageType,
    actual: unknown,
    expected: unknown,
  ): string;

  /**
   * Parse a string value (usually from a date/datetime/time input) into
   * epoch milliseconds. Used by the `Date` validator. Returns `NaN` when
   * the value cannot be parsed.
   */
  parseToMillis(field: SchemaField, v: string): number;
}

/**
 * Default {@link SchemaInterface} implementation. Delegates all three option
 * lookups to `field.options`, treats empty-value according to field type,
 * and compares values using native operators.
 *
 * Override subclasses can customise any of the methods — the form state
 * computation accepts any `SchemaInterface` via `FormGlobalOptions`.
 */
export class DefaultSchemaInterface implements SchemaInterface {
  protected booleanOptions: FieldOption[] = [
    { name: "Yes", value: true },
    { name: "No", value: false },
  ];

  isEmptyValue(field: SchemaField, value: unknown): boolean {
    if (field.collection) {
      return Array.isArray(value) ? value.length === 0 : value == null;
    }
    switch (field.type) {
      case FieldType.String:
      case FieldType.DateTime:
      case FieldType.Date:
      case FieldType.Time:
        return !value;
      default:
        return value == null;
    }
  }

  getOptions(field: SchemaField): FieldOption[] | null | undefined {
    if (field.options && field.options.length > 0) return field.options;
    if (field.type === FieldType.Bool) return this.booleanOptions;
    return null;
  }

  getNodeOptions(cursor: SchemaCursor): FieldOption[] | null | undefined {
    return this.getOptions(cursor.field);
  }

  getDataOptions(cursor: DataCursor): FieldOption[] | null | undefined {
    return this.getOptions(cursor.field);
  }

  compareValue(field: SchemaField, v1: unknown, v2: unknown): number {
    if (v1 == null) return v2 == null ? 0 : 1;
    if (v2 == null) return -1;
    switch (field.type) {
      case FieldType.Date:
      case FieldType.DateTime:
      case FieldType.Time:
      case FieldType.String:
        return (v1 as string).localeCompare(v2 as string);
      case FieldType.Bool:
        return v1 === v2 ? 0 : !v1 ? -1 : 1;
      case FieldType.Int:
      case FieldType.Double:
        return (v1 as number) - (v2 as number);
      default:
        return 0;
    }
  }

  controlLength(field: SchemaField, control: Control<unknown>): number {
    if (field.collection) {
      return (control as Control<unknown[]>).elementsNow?.length ?? 0;
    }
    return this.valueLength(field, control.valueNow);
  }

  valueLength(_field: SchemaField, value: unknown): number {
    const len = (value as { length?: unknown } | null | undefined)?.length;
    return typeof len === "number" ? len : 0;
  }

  validationMessageText(
    _field: SchemaField,
    messageType: ValidationMessageType,
    _actual: unknown,
    expected: unknown,
  ): string {
    switch (messageType) {
      case ValidationMessageType.NotEmpty:
        return "Please enter a value";
      case ValidationMessageType.MinLength:
        return "Length must be at least " + expected;
      case ValidationMessageType.MaxLength:
        return "Length must be less than " + expected;
      case ValidationMessageType.NotBeforeDate:
        return `Date must not be before ${new Date(
          expected as number,
        ).toDateString()}`;
      case ValidationMessageType.NotAfterDate:
        return `Date must not be after ${new Date(
          expected as number,
        ).toDateString()}`;
      default:
        return "Unknown error";
    }
  }

  /**
   * Default implementation uses native `Date` parsing. Subclasses that need
   * strict ISO-8601 handling or localised parsing should override (the old
   * `astrolabe-common` interface used `@internationalized/date`; porting
   * that dependency is not in scope for forms-core).
   */
  parseToMillis(_field: SchemaField, v: string): number {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? Number.NaN : t;
  }
}

/** Shared default instance — pass as the fallback when no override is needed. */
export const defaultSchemaInterface: SchemaInterface =
  new DefaultSchemaInterface();
