"use client";

import { useEffect, useRef, useState } from "react";
import { controls } from "@rxc/controls";
import type { DataRendererProps } from "@rxc/forms-react-core";
import { rendererClass } from "@rxc/forms-react-core";
import { useHtmlTheme } from "../../useHtmlTheme";

const DEFAULT_WRAPPER = "relative";
const DEFAULT_INPUT =
  "w-full rounded border px-2.5 py-1.5 text-sm dark:bg-zinc-800 dark:text-zinc-100";
const VALID_BORDER = "border-zinc-300 dark:border-zinc-600";
const INVALID_BORDER = "border-red-400 dark:border-red-600";
const DEFAULT_LIST =
  "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow";
const DEFAULT_OPTION =
  "cursor-pointer px-2.5 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700";
const DEFAULT_ACTIVE_OPTION = "bg-blue-50 dark:bg-blue-900/30";

/**
 * Single-select combobox. Filters the option list against the input's
 * current text; clicking an option commits its value. For Phase 2 this
 * is a minimal implementation — multi-select and full Downshift
 * accessibility (typeahead, virtualization) land in Phase 4b.
 */
export const AutocompleteRenderer = controls<DataRendererProps>(
  "AutocompleteRenderer",
  ({ node, id }, { rc, update }) => {
    const { data, fieldOptions, disabled, readonly, touched, definition } =
      node.getState(rc);
    const acTheme = useHtmlTheme().data?.autocomplete ?? {};
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!open) return;
      const onClick = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        )
          setOpen(false);
      };
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }, [open]);

    if (!data) return null;
    const value = rc.getValue(data);
    const options = fieldOptions ?? [];
    const selected = options.find((o) => o.value === value);
    const display = query ?? selected?.name ?? "";
    const filterText = (query ?? "").toLowerCase();
    const filtered =
      query == null
        ? options
        : options.filter((o) => o.name.toLowerCase().includes(filterText));
    const hasError = touched && !!rc.getError(data);

    const wrapperClass = rendererClass(
      definition.styleClass,
      acTheme.className ?? DEFAULT_WRAPPER,
    );
    const inputBase = acTheme.inputClass ?? DEFAULT_INPUT;
    const inputState = [
      hasError ? INVALID_BORDER : VALID_BORDER,
      disabled ? "opacity-50 cursor-not-allowed" : "",
      readonly ? "bg-zinc-50 dark:bg-zinc-800/50" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={containerRef} className={wrapperClass}>
        <input
          id={id}
          type="text"
          value={display}
          disabled={disabled}
          readOnly={readonly}
          aria-describedby={`${id}-error`}
          aria-invalid={hasError || undefined}
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          className={`${inputBase} ${inputState}`.trim()}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onBlur={() => update((wc) => wc.setTouched(data, true, true))}
        />
        {open && filtered.length > 0 && (
          <ul role="listbox" className={acTheme.listClass ?? DEFAULT_LIST}>
            {filtered.map((o) => (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={o.value === value}
                className={`${acTheme.optionClass ?? DEFAULT_OPTION} ${
                  o.value === value
                    ? acTheme.activeOptionClass ?? DEFAULT_ACTIVE_OPTION
                    : ""
                }`.trim()}
                onMouseDown={(e) => {
                  e.preventDefault();
                  update((wc) => wc.setValue(data, o.value));
                  setQuery(null);
                  setOpen(false);
                }}
              >
                {o.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
