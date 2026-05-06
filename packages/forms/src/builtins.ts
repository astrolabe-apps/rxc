import { FieldType } from "@rxc/forms-core";
import {
  matchAll,
  matchCompoundField,
  matchDataAlways,
  matchGroupAlways,
  matchSchemaType,
} from "./matchers";
import { combineRegistries, type FormRegistry } from "./registry";
import { TextfieldRenderer } from "./renderers/data/Textfield";
import { NumberRenderer } from "./renderers/data/Number";
import { CompoundDelegate } from "./renderers/data/Compound";
import { StandardGroupRenderer } from "./renderers/group/Standard";

/**
 * Phase 1 default registry. Order is most-specific first.
 *
 * - Compound data → delegate to group dispatch
 * - Int/Double → NumberRenderer
 * - Catch-all → TextfieldRenderer
 * - Group catch-all → StandardGroupRenderer
 *
 * Phase 2 will fill in the rest of the data and group matcher lists.
 */
export function defaultRegistry(): FormRegistry {
  return combineRegistries({
    data: [
      matchCompoundField(CompoundDelegate),
      matchSchemaType(FieldType.Int, NumberRenderer),
      matchSchemaType(FieldType.Double, NumberRenderer),
      matchDataAlways(TextfieldRenderer),
    ],
    group: [matchGroupAlways(StandardGroupRenderer)],
    action: [],
    display: [],
  });
}
