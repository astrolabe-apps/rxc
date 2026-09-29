import type {
  ComponentType,
  CSSProperties,
  FocusEventHandler,
  ReactNode,
  Ref,
} from "react";
import type { ClassValue, FormProp } from "./props.js";
import { useRenderers } from "./registry.js";

/**
 * The chrome around one field: label, control, help and error, laid out and
 * wired for accessibility. Resolved from the active implementation, so a
 * third-party widget looks native under every one of them.
 *
 * @group Implementations
 */
export interface FieldShellProps {
  /** The control's id — what the label points at. */
  id: string;
  /** The label. */
  label?: ReactNode;
  /** Draw the label as a `label` element, or a `legend` over a group of controls. */
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
  /** Draw the required marker. */
  required?: boolean;
  /** The field is disabled; some libraries grey the label and help from this. */
  disabled?: boolean;
  /** Help text. */
  helpText?: ReactNode;
  /** The error to show. */
  error?: ReactNode;
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
  /** The field is invalid. */
  invalid?: boolean;
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
 * A layout box — the one neutral layout primitive. Its props are exactly what
 * the JSON format's flex options carry, so it cannot drift into a UI kit.
 *
 * @group Authoring
 */
export interface StackProps {
  /** Main axis. Default `column`. */
  direction?: FormProp<"column" | "row">;
  /** Space between children. */
  gap?: FormProp<string | number>;
  /** Distribution along the main axis. */
  justify?: FormProp<
    "start" | "center" | "end" | "space-between" | "space-around"
  >;
  /** Alignment across it. */
  align?: FormProp<"start" | "center" | "end" | "stretch" | "baseline">;
  /** Let children wrap. */
  wrap?: FormProp<boolean>;
  /** The box. */
  className?: FormProp<ClassValue>;
  /** The children. */
  children: ReactNode;
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
 * The active implementation's layout box.
 *
 * @group Implementations
 */
export function useStack(): ComponentType<StackProps> {
  return useRenderers().stack;
}

/**
 * A layout box from the active implementation.
 *
 * @group Authoring
 */
export function Stack(props: StackProps): ReactNode {
  const S = useStack();
  return <S {...props} />;
}

/**
 * The id a control's `aria-describedby` should name: the shell's error when
 * there is one, else its help, else nothing. For an implementation wiring a
 * control to a shell by hand.
 *
 * @group Implementations
 */
export function describedBy(field: {
  id: string;
  error?: ReactNode;
  helpText?: ReactNode;
}): string | undefined {
  return field.error
    ? `${field.id}-error`
    : field.helpText
      ? `${field.id}-help`
      : undefined;
}
