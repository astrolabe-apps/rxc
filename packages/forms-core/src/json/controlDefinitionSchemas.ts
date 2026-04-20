import { FieldType } from "./schemaField";

/** Coercion function registered for a scriptable field. */
export type Coerce = (v: unknown) => unknown;

export function coerceForFieldType(fieldType: string): Coerce {
  switch (fieldType) {
    case FieldType.Bool:
      return (r) => !!r;
    case FieldType.Int:
    case FieldType.Double:
      return (r) => (typeof r === "number" ? r : undefined);
    case FieldType.String:
      return coerceStringValue;
    case FieldType.Compound:
      return (v) => (typeof v === "object" ? v : undefined);
    default:
      return (r) => r;
  }
}

function coerceStringValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  switch (typeof v) {
    case "number":
    case "boolean":
      return v.toString();
    default:
      return JSON.stringify(v);
  }
}
