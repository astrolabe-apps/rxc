"use client";

import { useEffect, useRef } from "react";
import { useControls, type Rendered } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import {
  rendererClass,
  useAutocompleteController,
} from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

/**
 * Single-select combobox. The controller owns the open/query state machine
 * + option filtering; the renderer owns the DOM, theme, and the
 * click-outside listener (which needs a container ref). Multi-select and
 * full Downshift accessibility (typeahead, virtualization) are still TODO.
 */
export function AutocompleteRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const c = useAutocompleteController(rc, node);
  const acTheme = useHtmlTheme().data.autocomplete;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!c.open) return;
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        c.setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.open]);

  if (!c.data) return rendered(null);
  const wrapperClass = rendererClass(c.styleClass, acTheme.className);

  return rendered(
    <div ref={containerRef} className={wrapperClass}>
      <input
        id={id}
        type="text"
        value={c.display}
        disabled={c.disabled}
        readOnly={c.readonly}
        aria-describedby={`${id}-error`}
        aria-invalid={c.hasError || undefined}
        aria-autocomplete="list"
        aria-expanded={c.open}
        role="combobox"
        className={acTheme.inputClass}
        onFocus={c.onFocus}
        onChange={(e) => c.onQueryChange(e.target.value)}
        onBlur={c.onBlur}
      />
      {c.open && c.filtered.length > 0 && (
        <ul role="listbox" className={acTheme.listClass}>
          {c.filtered.map((o) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === c.value}
              className={`${acTheme.optionClass ?? ""} ${
                o.value === c.value ? acTheme.activeOptionClass ?? "" : ""
              }`.trim()}
              onMouseDown={(e) => {
                e.preventDefault();
                c.selectOption(o.value);
              }}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
