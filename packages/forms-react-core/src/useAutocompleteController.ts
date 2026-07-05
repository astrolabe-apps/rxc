"use client";

import { useState } from "react";
import type { Control, ReadContext } from "@rxc/controls-core";
import { useControlContext } from "@rxc/controls";
import type { FieldOption, FormStateNode } from "@rxc/forms-core";

/**
 * Platform-agnostic controller for the single-select combobox. Owns the
 * open/query state machine, option filtering, and the display-text +
 * selection logic — everything except the DOM element choice, the theme
 * classes, and the click-outside listener (which needs a container ref and
 * lives in the platform renderer). A React Native combobox reuses this
 * hook verbatim and swaps the listener for a backdrop press.
 *
 * Contract: `(rc, node)`, writes via `useControlContext().update`.
 */
export interface AutocompleteController {
  data: Control<unknown> | undefined;
  /** Currently stored value (for the option's selected/active comparison). */
  value: unknown;
  /** Text shown in the input — the live query, else the selected name. */
  display: string;
  options: FieldOption[];
  /** Options filtered by the current query (all options when query is null). */
  filtered: FieldOption[];
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string | null;
  disabled: boolean;
  readonly: boolean;
  hasError: boolean;
  styleClass: string | null | undefined;
  /** Buffer a typed query and open the list. */
  onQueryChange: (text: string) => void;
  /** Open the list (e.g. on focus). */
  onFocus: () => void;
  /** Commit an option: store its value, clear the query, close the list. */
  selectOption: (value: unknown) => void;
  onBlur: () => void;
}

export function useAutocompleteController(
  rc: ReadContext,
  node: FormStateNode,
): AutocompleteController {
  const ctx = useControlContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const { data, fieldOptions, disabled, readonly, touched, definition } =
    node.getState(rc);
  const value = data ? rc.getValue(data) : undefined;
  const options = fieldOptions ?? [];
  const selected = options.find((o) => o.value === value);
  const filterText = (query ?? "").toLowerCase();
  const filtered =
    query == null
      ? options
      : options.filter((o) => o.name.toLowerCase().includes(filterText));
  return {
    data,
    value,
    display: query ?? selected?.name ?? "",
    options,
    filtered,
    open,
    setOpen,
    query,
    disabled: !!disabled,
    readonly: !!readonly,
    hasError: !!touched && !!data && !!rc.getError(data),
    styleClass: definition.styleClass,
    onQueryChange: (text) => {
      setQuery(text);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    selectOption: (v) => {
      ctx.update((wc) => data && wc.setValue(data, v));
      setQuery(null);
      setOpen(false);
    },
    onBlur: () => ctx.update((wc) => data && wc.setTouched(data, true, true)),
  };
}
