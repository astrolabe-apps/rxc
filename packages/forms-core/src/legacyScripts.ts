import {
  type ControlDefinition,
  DynamicPropertyType,
  type EntityExpression,
  ExpressionType,
  isDataControl,
  isDataGroupRenderer,
  isDisplayControl,
  isDisplayOnlyRenderer,
  isGroupControl,
  isHtmlDisplay,
  isTextDisplay,
} from "./json";

/**
 * Convert a {@link ControlDefinition}'s legacy `dynamic[]` entries into the
 * new `$scripts` layout expected by the scripted proxy.
 *
 * The returned map is keyed by schema path — `""` for root, nested compound
 * paths (e.g. `"displayData"`, `"renderOptions.groupOptions"`) for sub-objects.
 *
 * `Display` and `GridColumns` route to a nested path depending on the
 * control type and renderer — matching the legacy `formStateNode.ts`
 * mapping so the scripted proxy picks them up via `getScripts(target, path)`.
 */
export function buildLegacyScripts(
  def: ControlDefinition,
): Map<string, Record<string, EntityExpression>> {
  const map = new Map<string, Record<string, EntityExpression>>();
  if (!def.dynamic?.length) return map;

  const rootScripts: Record<string, EntityExpression> = {};
  const setNested = (path: string, key: string, expr: EntityExpression) => {
    const existing = map.get(path) ?? {};
    existing[key] = expr;
    map.set(path, existing);
  };

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
      case DynamicPropertyType.Display:
        if (isDisplayControl(def)) {
          if (def.displayData && isTextDisplay(def.displayData)) {
            setNested("displayData", "text", dp.expr);
          } else if (def.displayData && isHtmlDisplay(def.displayData)) {
            setNested("displayData", "html", dp.expr);
          }
        } else if (
          isDataControl(def) &&
          def.renderOptions &&
          isDisplayOnlyRenderer(def.renderOptions)
        ) {
          setNested("renderOptions", "overrideText", dp.expr);
        }
        break;
      case DynamicPropertyType.GridColumns:
        if (isGroupControl(def) && def.groupOptions) {
          setNested("groupOptions", "columns", dp.expr);
        } else if (
          isDataControl(def) &&
          isDataGroupRenderer(def.renderOptions) &&
          def.renderOptions.groupOptions
        ) {
          setNested("renderOptions.groupOptions", "columns", dp.expr);
        }
        break;
    }
  }

  if (Object.keys(rootScripts).length > 0) {
    map.set("", rootScripts);
  }
  return map;
}
