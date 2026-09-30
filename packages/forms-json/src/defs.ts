import type {
  ActionControlDefinition,
  ControlAdornment,
  ControlDefinition,
  DataControlDefinition,
  DisplayControlDefinition,
  DynamicProperty,
  EntityExpression,
  GroupedControlsDefinition,
  SchemaField,
  SchemaValidator,
} from "@rx-controls/forms-schema";
import type { ClassValue, FieldOption } from "@rx-controls/forms-react";

/*
 * The canonical types are a discriminated family keyed on `type`, and most of
 * what a render type means lives in open option records (`renderOptions`,
 * `groupOptions`, `displayData`) the format extends per render type. The
 * loader reads across all of them from one place, so it reads through these
 * views: every subtype's properties optional, and the option records open.
 * Internal — a host's translator gets the canonical `ControlDefinition` and
 * narrows as it likes.
 */

type Open<T> = T & Record<string, unknown>;

/** Arrays the base types declare with a narrower element than the views. */
type Listed = "dynamic" | "validators" | "adornments" | "children";

/** Every definition subtype's properties at once. */
export type AnyDef = Omit<ControlDefinition, Listed> &
  Partial<Omit<DataControlDefinition, "type" | "renderOptions" | Listed>> &
  Partial<Omit<GroupedControlsDefinition, "type" | "groupOptions" | Listed>> &
  Partial<Omit<DisplayControlDefinition, "type" | "displayData" | Listed>> &
  Partial<Omit<ActionControlDefinition, "type" | Listed>> & {
    /** On the wire for every action; typed on `ActionOptions` only. */
    actionText?: string | null;
    renderOptions?: Open<{ type: string }> | null;
    groupOptions?: Open<{ type: string; hideTitle?: boolean | null }>;
    displayData?: Open<{ type: string }>;
    dynamic?: DynamicProperty[] | null;
    validators?: AnyValidator[] | null;
    adornments?: AnyAdornment[] | null;
    children?: AnyDef[] | null;
  };

/** A schema field, with a compound's `children` whichever subtype it is. */
export type AnyField = SchemaField & { children?: SchemaField[] | null };

export type AnyExpr = Open<EntityExpression>;
export type AnyValidator = Open<SchemaValidator>;
export type AnyAdornment = Open<ControlAdornment>;

export const asDef = (d: ControlDefinition): AnyDef => d as AnyDef;
export const asField = (f: SchemaField | undefined): AnyField | undefined =>
  f as AnyField | undefined;

export const childrenOf = (f: SchemaField | undefined): SchemaField[] =>
  (f as AnyField | undefined)?.children ?? [];

/**
 * A schema's options as the contract takes them. The format allows `null`
 * for an absent `disabled`; the contract does not.
 */
export function schemaOptions(f: SchemaField | undefined): FieldOption[] {
  return (f?.options ?? []).map((o) => ({
    name: o.name,
    value: o.value,
    disabled: o.disabled ?? undefined,
  }));
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * The four class slots: `styleClass` → the control, `textClass` → its text,
 * `layoutClass` → the shell, `labelClass` → the label. Legacy spells *replace
 * rather than merge* as an `"@ "` prefix inside the string; the contract
 * types it as `{ replace }`.
 */
export function toClassValue(s: unknown): ClassValue | undefined {
  if (typeof s !== "string" || !s) return undefined;
  return s.startsWith("@ ") ? { replace: s.slice(2) } : s;
}
