import type { ClassLook, ClassValue } from "@rx-controls/forms-react";

/**
 * What a legacy control's class slots come to, for turning them into a look.
 *
 * A legacy control carries up to five class strings — `styleClass`,
 * `textClass`, `layoutClass`, `labelClass`, `labelTextClass` — and a form
 * reuses the same few combinations over and over. A **look** is a name for
 * one such combination: the host's theme says what it draws, and the form
 * carries only the name. {@link legacyLookKey} is how a combination is
 * recognised.
 *
 * @packageDocumentation
 */

/**
 * The five class slots of a legacy control, as the format spells them.
 *
 * @group Hosts
 */
export interface LegacyClassSlots {
  styleClass?: unknown;
  textClass?: unknown;
  layoutClass?: unknown;
  labelClass?: unknown;
  labelTextClass?: unknown;
  /** A radio's per-option classes: `renderOptions.entryWrapperClass`, `selectedClass`, `notSelectedClass`. */
  entryWrapperClass?: unknown;
  selectedClass?: unknown;
  notSelectedClass?: unknown;
}

/**
 * A slot's classes in a form that is equal for equal meaning: the `"@ "`
 * replace marker kept, the tokens de-duplicated and sorted. Utility classes of
 * one kind resolve by stylesheet order, not by the order they are written, so
 * sorting changes no styling.
 */
function canonicalSlot(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  const replace = v.startsWith("@ ");
  const tokens = (replace ? v.slice(2) : v).split(/\s+/).filter(Boolean);
  return (replace ? "@ " : "") + [...new Set(tokens)].sort().join(" ");
}

/**
 * The key of a legacy control's class slots: its kind (the definition's
 * `type`) and the five slots (and a radio's three per-option ones), each in canonical form. Equal keys are one look.
 * `undefined` when the control styles nothing.
 *
 * The label slots count only for a control that draws a label (`labelled`),
 * as the loader passes them on only for one.
 *
 * @group Hosts
 */
export function legacyLookKey(
  kind: string,
  slots: LegacyClassSlots,
  labelled: boolean,
): string | undefined {
  const parts = [
    canonicalSlot(slots.styleClass),
    canonicalSlot(slots.textClass),
    canonicalSlot(slots.layoutClass),
    labelled ? canonicalSlot(slots.labelClass) : "",
    labelled ? canonicalSlot(slots.labelTextClass) : "",
    canonicalSlot(slots.entryWrapperClass),
    canonicalSlot(slots.selectedClass),
    canonicalSlot(slots.notSelectedClass),
  ];
  return parts.some(Boolean) ? JSON.stringify([kind, ...parts]) : undefined;
}

/** The format's `"@ "` prefix means replace, not merge. */
function classValue(s: unknown): ClassValue | undefined {
  if (typeof s !== "string" || !s) return undefined;
  return s.startsWith("@ ") ? { replace: s.slice(2) } : s;
}

/** A 48-bit FNV-1a, as 12 hex digits: stable everywhere, and no crypto to load in a browser. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0xdeadbeef;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b);
  }
  return ((a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0")).slice(0, 12);
}

/**
 * The name of the look for a {@link legacyLookKey}. Content-addressed, so the
 * same classes are the same name in every form and every run, with nothing to
 * coordinate: a lone typography slot (`textClass: "body"`) is its own classes
 * (`body`), anything else is `look-` and a hash of them. A host restyles a
 * name by defining it in its theme.
 *
 * @group Hosts
 */
export function legacyLookName(key: string): string {
  const [, style, text, layout, label, labelText, entry, selected, notSelected] = JSON.parse(key) as string[];
  const others = [style, layout, label, labelText, entry, selected, notSelected];
  if (text && !text.startsWith("@ ") && others.every((s) => !s)) {
    const name = text.split(/\s+/).join("-").toLowerCase();
    if (/^[a-z][a-z0-9-]{0,39}$/.test(name)) return name;
  }
  return "look-" + hash(JSON.stringify(JSON.parse(key).slice(1)));
}

/**
 * A look derived from a legacy control's class slots: its name and what it
 * gives each part — the classes as the form wrote them, `"@ "` as `{ replace }`.
 * `undefined` when the control styles nothing.
 *
 * @group Hosts
 */
export function legacyLook(
  kind: string,
  slots: LegacyClassSlots,
  labelled: boolean,
): { name: string; parts: ClassLook } | undefined {
  const key = legacyLookKey(kind, slots, labelled);
  if (key === undefined) return undefined;
  const parts: ClassLook = {};
  const put = (part: keyof ClassLook, v: unknown) => {
    const c = classValue(v);
    if (c !== undefined) parts[part] = c;
  };
  put("control", slots.styleClass);
  put("text", slots.textClass);
  put("shell", slots.layoutClass);
  if (labelled) {
    put("label", slots.labelClass);
    put("labelText", slots.labelTextClass);
  }
  put("entry", slots.entryWrapperClass);
  put("selected", slots.selectedClass);
  put("notSelected", slots.notSelectedClass);
  return { name: legacyLookName(key), parts };
}
