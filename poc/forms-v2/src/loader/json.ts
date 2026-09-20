/**
 * The JSON format — a small, faithful subset of `ControlDefinition` and
 * `SchemaField`.
 *
 * These types live *here*, in the loader, and nowhere else. That is the whole
 * claim of the design: no renderer, no boundary and no binding mentions them.
 */

export type FieldType = "String" | "Int" | "Bool" | "Compound";

export interface SchemaField {
  field: string;
  type: FieldType;
  displayName?: string;
  collection?: boolean;
  options?: { name: string; value: string | number }[];
  children?: SchemaField[];
}

export type EntityExpression =
  | { type: "Data"; field: string }
  | { type: "NotEmpty"; field: string; empty?: boolean }
  | { type: "DataMatch"; field: string; value: unknown }
  | { type: "Jsonata"; expression: string };

export type DynamicPropertyType = "Visible" | "Disabled" | "Label";

export interface DynamicProperty {
  type: DynamicPropertyType;
  expr: EntityExpression;
}

export interface ValidatorDef {
  type: "Length";
  min?: number;
  max?: number;
}

/**
 * Deliberately open: the real format has six adornment types and hosts add
 * their own, so a loader meets ones it has never heard of. Nothing here
 * translates any of them — which is what the warning is for.
 */
export interface ControlAdornment {
  type: string;
  [k: string]: unknown;
}

export interface ControlDefinition {
  type: "Data" | "Group" | "Action" | "Display";
  title?: string;
  /** Data controls only. */
  field?: string;
  required?: boolean;
  requiredErrorText?: string;
  hidden?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  dontClearHidden?: boolean;
  renderOptions?: { type: string; [k: string]: unknown };
  /** Display controls only. */
  displayData?: { type: string; text?: string; html?: string };
  groupOptions?: { type: string; [k: string]: unknown };
  validators?: ValidatorDef[];
  dynamic?: DynamicProperty[];
  adornments?: ControlAdornment[];
  children?: ControlDefinition[];
  /** Action controls only. */
  actionId?: string;
  actionText?: string;
}

export function findField(
  fields: SchemaField[],
  name: string,
): SchemaField | undefined {
  return fields.find((f) => f.field === name);
}
