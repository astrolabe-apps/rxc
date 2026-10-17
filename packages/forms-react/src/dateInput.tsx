import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { FocusTarget } from "./controllers.js";

/**
 * What a host's date control receives: the field's value ({@link DateMode}'s form) and how to
 * write one back, plus what the frame gives any control — its id, description, state, and a ref for focus.
 * It draws inside the field's frame, so the label, help, error and invalid border stay the
 * implementation's.
 *
 * @group Implementations
 */
export interface DateInputProps {
  /** What is picked: a date, a date and time, or a time of day — see {@link DateMode}. */
  mode: DateMode;
  /** The control's id: the label's `for`, and where focus goes. */
  id: string;
  /** The value, in {@link DateMode}'s form; `""` for none. */
  value: string;
  /** Write a value, in {@link DateMode}'s form; `""` clears it. */
  onChange(value: string): void;
  /** Leaving the control: the field is touched. */
  onBlur(): void;
  /** Entering the control: the frame shows focus. */
  onFocus?(): void;
  /** Locked: shown, not changeable. */
  disabled?: boolean;
  /** Shown, not changeable, still read as a value. */
  readOnly?: boolean;
  /** The field is required — `aria-required`, not the browser's own validation. */
  required?: boolean;
  /** The field is in error — `aria-invalid`. */
  invalid?: boolean;
  /** The words with no value. */
  placeholder?: string;
  /** The ids that describe the control: help, count, error. */
  "aria-describedby"?: string;
  /** Pass the element that takes focus, so a refused submit can focus the field. */
  focusRef(target: FocusTarget | null): void;
  /** The frame's class for its control, with the look's text: the web's to place. */
  className?: string;
  /** The frame's style for its control, with the look's text. */
  style?: Record<string, unknown>;
}

/**
 * What a picked field holds, as the same string on every platform — legacy's forms:
 * `date` a calendar date `2024-03-05`; `datetime` an instant, `2024-03-05T00:30:00.000Z`;
 * `time` a time of day, `10:30:00`.
 *
 * @group Implementations
 */
export type DateMode = "date" | "datetime" | "time";

/** A field's {@link DateMode}, from its `inputType`; `undefined` for any other input. */
export function dateModeOf(inputType: unknown): DateMode | undefined {
  return inputType === "date" || inputType === "datetime" || inputType === "time" ? inputType : undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A value as the browser's own input takes it: `datetime` as local `2024-03-05T11:30`
 * (`datetime-local` has no zone), `time` as `10:30`; a date as it is. `""` for none or nonsense.
 *
 * @group Implementations
 */
export function toBrowserDateValue(mode: DateMode, value: string): string {
  if (!value) return "";
  if (mode === "datetime") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (mode === "time") return value.slice(0, 5);
  return value;
}

/**
 * The browser input's value back in {@link DateMode}'s form: local date and time to an
 * instant, `10:30` to `10:30:00`.
 *
 * @group Implementations
 */
export function fromBrowserDateValue(mode: DateMode, input: string): string {
  if (!input) return "";
  if (mode === "datetime") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  if (mode === "time") return input.length === 5 ? `${input}:00` : input;
  return input;
}

/**
 * A value as legacy's picker showed it: `05/03/2024`, `05/03/2024, 11:30` (local time),
 * `10:30` — a device's default display of a picked field.
 *
 * @group Implementations
 */
export function formatDateValue(mode: DateMode, value: string): string {
  if (!value) return "";
  if (mode === "date") {
    const [y, m, d] = value.split("-");
    return y && m && d ? `${d}/${m}/${y}` : value;
  }
  if (mode === "time") return value.slice(0, 5);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DateInputContext = createContext<ComponentType<DateInputProps> | undefined>(undefined);

/**
 * A control for the picked fields below (`inputType` `date`, `datetime`, `time`) on the web implementations —
 * html, MUI, Ant, Fluent — in place of the browser's own input: a library's picker,
 * or one that writes `dd/mm/yyyy`. React Native takes its picker from its theme (`date.picker`).
 * Pass a stable component.
 *
 * @group Authoring
 */
export function DateInputProvider({ control, children }: { control: ComponentType<DateInputProps>; children?: ReactNode }): ReactNode {
  return <DateInputContext.Provider value={control}>{children}</DateInputContext.Provider>;
}

/**
 * The date control in scope, `undefined` for none — an implementation draws its own.
 *
 * @group Implementations
 */
export function useDateInput(): ComponentType<DateInputProps> | undefined {
  return useContext(DateInputContext);
}
