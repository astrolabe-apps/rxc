import {
  type ControlDefinition,
  DynamicPropertyType,
  type EntityExpression,
  ExpressionType,
} from "./json";

/**
 * Convert a {@link ControlDefinition}'s legacy `dynamic[]` entries into the
 * new `$scripts` layout expected by the scripted proxy.
 *
 * The returned map is keyed by schema path — `""` for root, nested compound
 * paths (e.g. `"displayData"`, `"renderOptions.groupOptions"`) for sub-objects.
 *
 * **Scope (layer 4a):** the bucket is built but only the root path is read
 * by {@link createEvaluatedDefinition}. Nested-compound scripts will be
 * wired once the nested-proxy machinery is ported.
 */
export function buildLegacyScripts(
  def: ControlDefinition,
): Map<string, Record<string, EntityExpression>> {
  const map = new Map<string, Record<string, EntityExpression>>();
  if (!def.dynamic?.length) return map;

  const rootScripts: Record<string, EntityExpression> = {};

  for (const dp of def.dynamic) {
    if (!dp.expr?.type) continue;
    switch (dp.type) {
      case DynamicPropertyType.Visible:
        // `Visible` is the inverse of `hidden` — wrap the expression in a
        // `Not` so the scripted proxy writes the correctly-inverted value
        // into `hidden`.
        rootScripts["hidden"] = {
          type: ExpressionType.Not,
          innerExpression: dp.expr,
        } as EntityExpression;
        break;
      case DynamicPropertyType.Readonly:
        rootScripts["readonly"] = dp.expr;
        break;
      case DynamicPropertyType.Disabled:
        rootScripts["disabled"] = dp.expr;
        break;
      case DynamicPropertyType.Label:
        rootScripts["title"] = dp.expr;
        break;
      case DynamicPropertyType.DefaultValue:
        rootScripts["defaultValue"] = dp.expr;
        break;
      case DynamicPropertyType.ActionData:
        rootScripts["actionData"] = dp.expr;
        break;
      case DynamicPropertyType.Style:
        rootScripts["style"] = dp.expr;
        break;
      case DynamicPropertyType.LayoutStyle:
        rootScripts["layoutStyle"] = dp.expr;
        break;
      case DynamicPropertyType.AllowedOptions:
        rootScripts["allowedOptions"] = dp.expr;
        break;
      // DynamicPropertyType.Display and .GridColumns route to nested
      // compounds (displayData / renderOptions.groupOptions) — handled
      // once the nested-proxy port lands.
    }
  }

  if (Object.keys(rootScripts).length > 0) {
    map.set("", rootScripts);
  }
  return map;
}
