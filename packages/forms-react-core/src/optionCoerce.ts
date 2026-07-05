import type { ReadContext } from "@rxc/controls-core";
import { FieldType, type FormStateNode } from "@rxc/forms-core";

/**
 * Platform-agnostic value coercion shared by the options renderers
 * (Select / Radio). The on-the-wire representation for a single-select
 * control is a string; these helpers convert to and from the stored
 * value using the field's declared type.
 *
 * DOM-free — safe to reuse from any platform package.
 */

/** Convert a stored value to the string an options control uses. */
export function valueToString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

/** Parse a selected option string back to the stored value, honouring
 *  the field's declared type (Int / Double → number, Bool → boolean). */
export function stringToValue(
  raw: string,
  fieldType: string | undefined,
): unknown {
  if (raw === "") return null;
  if (fieldType === FieldType.Int || fieldType === FieldType.Double) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (fieldType === FieldType.Bool) {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  return raw;
}

/**
 * Build a lookup of per-option child nodes keyed by their option value.
 *
 * `defaultResolveChildren` spawns one child per option carrying
 * `meta.fieldOptionValue = option.value`; the Radio / Checklist renderers
 * render each under its option. This walks the current children and maps
 * them by that value.
 */
export function mapChildrenByOptionValue(
  rc: ReadContext,
  node: FormStateNode,
): Map<unknown, FormStateNode> {
  const childByValue = new Map<unknown, FormStateNode>();
  for (const child of node.getChildren(rc)) {
    const v = child.getState(rc).meta?.fieldOptionValue;
    if (v !== undefined) childByValue.set(v, child);
  }
  return childByValue;
}
