import type {
  ComponentType,
  CSSProperties,
  FocusEventHandler,
  ReactNode,
  Ref,
} from "react";
import type { ClassValue, FormProp } from "./props.js";
import { useRenderers } from "./registry.js";
import type { FieldController, FocusTarget } from "./controllers.js";
import type { CountFormat } from "./widgets.js";
import type { HelpPlacement } from "./field.js";

/**
 * The chrome around one field: label, control, help and error, laid out and
 * wired for accessibility. Resolved from the active implementation, so a
 * third-party widget looks native under every one of them.
 *
 * **The shell owns the ids around the control.** A control points its
 * `aria-describedby` at {@link describedBy}, so a shell must render the
 * `error`, when there is one, in an element with id {@link fieldErrorId}, and
 * otherwise the `helpText` in one with id {@link fieldHelpId}. And it renders
 * the label — a `label`, a `legend`, a trailing label — with id
 * {@link fieldLabelId}, so a widget whose control is not a labelable element
 * (a `role="radiogroup"`, a custom listbox) can name it with
 * `aria-labelledby`. A library whose own form item renders these under ids of
 * its own wraps them in elements carrying the contract's. The conformance
 * suite checks every widget's name and description through the accessibility
 * tree.
 *
 * @group Implementations
 */
export interface FieldShellProps {
  /** The control's id — what the label points at. */
  id: string;
  /**
   * Which widget the shell is around: the registry slot key for a built-in
   * (`"textfield"`, `"select"`, `"checkList"`, …), any name for a widget of
   * your own. A look whose shells differ by widget — a smaller label over a
   * select than over a text input — styles by it rather than replacing a
   * slot.
   */
  widget?: string;
  /** The label, under id {@link fieldLabelId}. */
  label?: ReactNode;
  /**
   * Render the label, still under id {@link fieldLabelId} and still what
   * names the control, but visually hidden: off screen, in the accessibility
   * tree. With it goes the required marker, which only decorates a label
   * someone can see; the control still says it is required.
   */
  hideLabel?: boolean;
  /**
   * Draw the label as a `label` element, or as a `legend`: a caption over a
   * group of controls the widget draws itself. The widget's group (a
   * `role="group"`, a `radiogroup`) is the one named group — it takes the
   * caption by `aria-labelledby` and the description by `aria-describedby` —
   * so the shell adds no group of its own: no `fieldset`.
   */
  labelAs?: "label" | "legend";
  /**
   * Where the label sits. `after` also lets the shell **wrap** the control,
   * which is how most libraries attach a trailing label — a `<label>` around a
   * checkbox. Default `before`.
   */
  labelPosition?: "before" | "after";
  /**
   * Whether an {@link InputFrameProps | input frame} sits inside, or the widget
   * draws its own surface. Libraries label the two differently — a floating
   * label over a frame, a static one above a radio group. Default `custom`.
   */
  surface?: "frame" | "custom";
  /** Label beside the control, or above it. Default `vertical`. */
  orientation?: "vertical" | "horizontal";
  /**
   * Draw the required marker. The marker is decoration — `aria-hidden`, so
   * it stays out of the field's accessible name; the control says it is
   * required itself, by `aria-required`.
   */
  required?: boolean;
  /**
   * The control cannot say it is required itself — a `role="group"` takes
   * neither `aria-required` nor `aria-invalid` — so the shell says it: with
   * `required`, visually hidden text under id {@link fieldRequiredId}, which
   * the widget puts first in its `aria-describedby`. In the description, not
   * the label, so the field's name stays exactly its label.
   */
  describeRequired?: boolean;
  /** The field is disabled; some libraries grey the label and help from this. */
  disabled?: boolean;
  /** Help text, under id {@link fieldHelpId} when no error is showing. */
  helpText?: ReactNode;
  /**
   * Where the help is drawn. `below` (the default): under the control.
   * `labelEnd`: a button at the label's end — named "Help", outside the
   * label element so the field's name stays its label, and reachable by
   * keyboard — that shows the help on demand. The help element itself stays
   * rendered under {@link fieldHelpId}, in the accessibility tree whether or
   * not it is showing, so the control's description is the same either way
   * (an error in its place while one shows, as {@link describedBy} has it).
   * The button stays while an error shows: the help is still worth reading.
   */
  helpPlacement?: HelpPlacement;
  /** The error to show, under id {@link fieldErrorId}. */
  error?: ReactNode;
  /**
   * A character count to draw with the field (`TextField`'s `showCount`,
   * through {@link countText}), under id {@link fieldCountId} — which
   * {@link describedBy} adds to the control's description.
   */
  count?: ReactNode;
  /** The value is past its limit: draw the count as over. */
  countOver?: boolean;
  /** The control. */
  children: ReactNode;
  /** The wrapper. */
  className?: ClassValue;
  /** The label's container. */
  labelClassName?: ClassValue;
  /** The label's text. A single-element label applies both label slots. */
  labelTextClassName?: ClassValue;
}

/**
 * What the input frame hands to the element it wraps — spread it onto the
 * native control.
 *
 * @group Implementations
 */
export interface ControlSlotProps {
  /** The control's id. */
  id: string;
  /** The frame's ref to the control. */
  ref?: Ref<any>;
  /** The frame's class for the control. */
  className?: string;
  /** The frame's inline style for the control — for libraries whose styles are runtime tokens. */
  style?: CSSProperties;
  /** Keep the frame's focus state. */
  onFocus?: FocusEventHandler;
  /** Keep the frame's focus state. */
  onBlur?: FocusEventHandler;
  /** Disabled. */
  disabled?: boolean;
  /** Read-only. */
  readOnly?: boolean;
  /** Invalid. */
  "aria-invalid"?: boolean;
  /**
   * Required — `aria-required` rather than the native attribute, which would
   * add the browser's own validation bubble to the form's.
   */
  "aria-required"?: boolean;
  /** The id of the help or error that describes it. */
  "aria-describedby"?: string;
}

/**
 * The frame's state, for content drawn inside it.
 *
 * @group Implementations
 */
export interface FrameState {
  /** The control has focus. */
  focused: boolean;
  /** The control has a value. */
  filled: boolean;
  /** The field is invalid. */
  invalid: boolean;
  /** The field is disabled. */
  disabled: boolean;
  /** The field is read-only. */
  readOnly: boolean;
  /** The control is multi-line. */
  multiline: boolean;
}

/**
 * The surface a text-like control sits in — border, focus ring, adornments at
 * either edge. Resolved from the active implementation.
 *
 * @group Implementations
 */
export interface InputFrameProps {
  /** The control's id. */
  id: string;
  /** The id of the element that describes the control. */
  describedBy?: string;
  /**
   * Draw the native control, spreading `slot` onto it. Called in the frame's
   * render, not the caller's: never read reactive state inside it — resolve
   * everything first and close over the values.
   */
  render: (slot: ControlSlotProps, state: FrameState) => ReactNode;
  /** Content at the leading edge. */
  start?: ReactNode | ((state: FrameState) => ReactNode);
  /** Content at the trailing edge. */
  end?: ReactNode | ((state: FrameState) => ReactNode);
  /**
   * The widget's {@link FieldController.elementRef}: the frame hands it to the
   * control in `slot.ref`, merged with any ref of its own.
   */
  controlRef?: (target: FocusTarget | null) => void;
  /** The field is invalid. */
  invalid?: boolean;
  /** The field is required: the control's `aria-required`. */
  required?: boolean;
  /** The field is disabled. */
  disabled?: boolean;
  /** The field is read-only. */
  readOnly?: boolean;
  /** The control is multi-line; affects alignment. */
  multiline?: boolean;
  /**
   * The control has a value. The frame never sees the value, so it is told —
   * floating and shrinking labels need it.
   */
  filled?: boolean;
  /** The frame. */
  className?: ClassValue;
}

/**
 * The implementation's `visibility` slot: it owns the mount lifetime of what a
 * boundary renders, so an exit transition can keep the content mounted while
 * it leaves.
 *
 * `visible` is `false` only for `hidden`. Silent content stays visible to this
 * slot — mounted, with its container hiding it — so a tab switch never
 * unmounts a widget.
 *
 * @group Implementations
 */
export interface VisibilityProps {
  /** Show the content. */
  visible: boolean;
  /** The content. */
  children: ReactNode;
}

/**
 * The active implementation's field shell.
 *
 * @group Implementations
 */
export function useFieldShell(): ComponentType<FieldShellProps> {
  return useRenderers().fieldShell;
}

/**
 * The active implementation's input frame.
 *
 * @group Implementations
 */
export function useInputFrame(): ComponentType<InputFrameProps> {
  return useRenderers().inputFrame;
}

/**
 * The id the {@link FieldShellProps | shell} renders a field's label under —
 * for `aria-labelledby` on a control a `label` element cannot name.
 *
 * @group Implementations
 */
export function fieldLabelId(id: string): string {
  return `${id}-label`;
}

/**
 * The id the {@link FieldShellProps | shell} renders a field's error under.
 *
 * @group Implementations
 */
export function fieldErrorId(id: string): string {
  return `${id}-error`;
}

/**
 * The id the {@link FieldShellProps | shell} renders a field's help under.
 *
 * @group Implementations
 */
export function fieldHelpId(id: string): string {
  return `${id}-help`;
}

/**
 * The id the {@link FieldShellProps | shell} renders a field's "required"
 * note under, for a control that cannot carry `aria-required`
 * ({@link FieldShellProps.describeRequired}).
 *
 * @group Implementations
 */
export function fieldRequiredId(id: string): string {
  return `${id}-required`;
}

/**
 * The id a control's `aria-describedby` should name: the shell's error when
 * there is one, else its help, else nothing — the element the shell is bound
 * to render. For an implementation, or a widget written outside one, wiring
 * a control to its shell.
 *
 * @group Implementations
 */
export function describedBy(field: {
  id: string;
  error?: ReactNode;
  helpText?: ReactNode;
  /** A count the shell draws ({@link FieldShellProps.count}): named after the help or error. */
  count?: ReactNode;
}): string | undefined {
  const main = field.error
    ? fieldErrorId(field.id)
    : field.helpText
      ? fieldHelpId(field.id)
      : undefined;
  if (field.count == null) return main;
  return main ? `${main} ${fieldCountId(field.id)}` : fieldCountId(field.id);
}

/**
 * The id the {@link FieldShellProps | shell} renders a field's character
 * count under.
 *
 * @group Implementations
 */
export function fieldCountId(id: string): string {
  return `${id}-count`;
}

/**
 * What a `showCount` draws for a value: the formatter's words, or "n / max"
 * (just "n" with no limit). Nothing when the count is not asked for.
 *
 * @group Implementations
 */
export function countText(
  value: string,
  showCount: boolean | CountFormat | undefined,
  max: number | undefined,
): ReactNode {
  if (!showCount) return undefined;
  const n = value.length;
  if (showCount !== true) return showCount.format(n, max);
  return max === undefined ? String(n) : `${n} / ${max}`;
}
