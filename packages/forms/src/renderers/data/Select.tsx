"use client";

import { useReactive, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import {
  rendererClass,
  useSelectController,
  valueToString,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

export function SelectRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const c = useSelectController(rc, node);
  const selectTheme = useHtmlTheme().data.select;
  if (!c.data) return rendered(null);
  const className = rendererClass(c.styleClass, selectTheme.className);
  const placeholder =
    c.isEmpty && c.required ? selectTheme.requiredText : selectTheme.emptyText;
  const groupKeys = Array.from(c.groups.keys());

  return rendered(
    <select
      id={id}
      value={c.value}
      disabled={c.disabled || c.readonly}
      aria-describedby={`${id}-error`}
      aria-invalid={c.hasError || undefined}
      className={className}
      onChange={(e) => c.onChangeValue(e.target.value)}
      onBlur={c.onBlur}
    >
      {(!c.required || c.isEmpty) && (
        <option value="">{placeholder}</option>
      )}
      {c.usesGroups
        ? groupKeys.map((g) =>
            g == null ? (
              c.groups
                .get(g)!
                .map((o) => (
                  <option key={String(o.value)} value={valueToString(o.value)}>
                    {o.name}
                  </option>
                ))
            ) : (
              <optgroup key={g} label={g}>
                {c.groups.get(g)!.map((o) => (
                  <option key={String(o.value)} value={valueToString(o.value)}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            ),
          )
        : c.options.map((o) => (
            <option key={String(o.value)} value={valueToString(o.value)}>
              {o.name}
            </option>
          ))}
    </select>
  );
}
