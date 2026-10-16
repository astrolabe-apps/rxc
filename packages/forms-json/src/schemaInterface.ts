import type { ReadContext } from "@rx-controls/core";
import type { FieldOption } from "@rx-controls/forms-react";
import { ValidationMessageType, type SchemaField } from "@rx-controls/forms-schema";
import { schemaOptions } from "./defs.js";

/**
 * What the loader asks of a schema field's values — legacy's `SchemaInterface`,
 * the part of it a form needs: when a value is empty, how it reads as text,
 * how a date parses, what a validation message says and which options a field
 * offers. Pass one as {@link LoaderOptions.schemaInterface}; extending
 * {@link DefaultSchemaInterface} and overriding a method is how a legacy host's
 * subclass carries across.
 *
 * Not here, since nothing in Forms v2 sorts or searches yet: legacy's
 * `compareValue`, `searchText` and `getFilterOptions`.
 *
 * @group Loading
 */
export interface SchemaInterface {
  /** Whether a value counts as empty: a `NotEmpty` expression and a display-only field's empty text. */
  isEmptyValue(field: SchemaField, value: unknown): boolean;
  /**
   * A value as text — a display-only field's. A collection's elements are
   * joined unless `element`; a value one of `options` names reads as its name.
   */
  textValue(
    field: SchemaField,
    value: unknown,
    element?: boolean,
    options?: readonly FieldOption[] | null,
  ): string | undefined;
  /** A value's length, for the `Length` validator on a field that is not a collection. */
  valueLength(field: SchemaField, value: unknown): number;
  /** A date or date-time as milliseconds, for the `Date` validator. */
  parseToMillis(field: SchemaField, value: string): number;
  /** The message a failed rule shows when the definition gives none. */
  validationMessageText(
    field: SchemaField,
    messageType: ValidationMessageType,
    actual: unknown,
    expected: unknown,
  ): string;
  /**
   * The options a field offers, before `AllowedOptions` narrows them —
   * legacy's `getNodeOptions` / `getDataOptions` / `getOptions` in one.
   * `path` is the field's schema path from the root (`a/b`, no row indexes),
   * legacy's `getSchemaNodePathString`. Called while drawing, through `rc`:
   * options held in a control follow it.
   */
  getOptions(
    field: SchemaField,
    path: string,
    rc: ReadContext,
  ): readonly FieldOption[] | null | undefined;
}

/**
 * Legacy's `DefaultSchemaInterface`, method for method: dates in the
 * runtime's locale, a naive date-time as UTC, legacy's messages word for word.
 *
 * @group Loading
 */
export class DefaultSchemaInterface implements SchemaInterface {
  constructor(
    /** A Bool's text: false, then true. */
    protected boolStrings: [string, string] = ["No", "Yes"],
    /** Between a collection's elements' text. */
    protected arraySeparator: string = ", ",
  ) {}

  isEmptyValue(field: SchemaField, value: unknown): boolean {
    if (field.collection)
      return Array.isArray(value) ? value.length === 0 : value == null;
    switch (field.type) {
      case "String":
      case "DateTime":
      case "Date":
      case "Time":
        return !value;
      default:
        return value == null;
    }
  }

  textValue(
    field: SchemaField,
    value: unknown,
    element?: boolean,
    options?: readonly FieldOption[] | null,
  ): string | undefined {
    if (field.collection && !element) {
      if (!Array.isArray(value)) return undefined;
      return value
        .map((v) => this.textValue(field, v, true, options))
        .filter((x): x is string => Boolean(x))
        .join(this.arraySeparator);
    }
    const option = (options ?? schemaOptions(field)).find((x) => x.value === value);
    if (option) return option.name;
    switch (field.type) {
      case "Date":
        return value ? new Date(value as string).toLocaleDateString() : undefined;
      case "DateTime":
        return value
          ? new Date(this.parseToMillis(field, String(value))).toLocaleString()
          : undefined;
      case "Time":
        return value
          ? new Date("1970-01-01T" + value).toLocaleTimeString()
          : undefined;
      case "Bool":
        return value != null ? this.boolStrings[value ? 1 : 0] : undefined;
      default:
        return value != null ? String(value) : undefined;
    }
  }

  valueLength(_field: SchemaField, value: unknown): number {
    const len = (value as { length?: unknown } | null | undefined)?.length;
    return typeof len === "number" ? len : 0;
  }

  /** A naive date-time is UTC. */
  parseToMillis(_field: SchemaField, value: string): number {
    const hasTime = value.includes("T");
    const hasZone = /[zZ]$|[+-]\d\d:?\d\d$/.test(value);
    return new Date(hasTime && !hasZone ? value + "Z" : value).getTime();
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
        return `Date must not be before ${new Date(expected as number).toDateString()}`;
      case ValidationMessageType.NotAfterDate:
        return `Date must not be after ${new Date(expected as number).toDateString()}`;
      default:
        return "Unknown error";
    }
  }

  getOptions(
    field: SchemaField,
    _path: string,
    _rc: ReadContext,
  ): readonly FieldOption[] | null | undefined {
    const options = schemaOptions(field);
    return options.length ? options : null;
  }
}

/**
 * The loader's default {@link SchemaInterface}.
 *
 * @group Loading
 */
export const defaultSchemaInterface: SchemaInterface = new DefaultSchemaInterface();
