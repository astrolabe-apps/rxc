import type {
  ComponentType,
  CSSProperties,
  FocusEventHandler,
  ReactNode,
  Ref,
} from "react";
import type { Control, ReadContext } from "@rx-controls/core";

// ── §1 Reactive props ────────────────────────────────────────────────

export type FormProp<T> = T | ((rc: ReadContext) => T) | Control<T>;

/**
 * The resolved form of a prop bag: every `FormProp<T>` collapses to `T`.
 *
 * Written as two *reactive-shape* tests with a fallback rather than
 * `X extends FormProp<infer T>`: the bare `T` member of `FormProp` is a naked
 * type parameter, so matching against the whole union infers `T` as the union
 * itself. Checking the function and control shapes first, and distributing,
 * gets the right answer for `string | ((rc) => string) | Control<string> |
 * undefined` → `string | undefined`.
 */
export type Resolved<P> = { [K in keyof P]: UnwrapProp<P[K]> };
export type UnwrapProp<X> = X extends (rc: ReadContext) => infer T
  ? T
  : X extends Control<infer T>
    ? T
    : X;

// ── §2 Class values ──────────────────────────────────────────────────

export type ClassValue = string | { replace: string };

// ── §3 The two handles ───────────────────────────────────────────────

export interface FieldState {
  disabled: boolean;
  readOnly: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}

export type FormFields<T> = {
  [K in keyof NonNullable<T>]-?: FormField<NonNullable<T>[K]>;
};

/**
 * A **scoped control handle**. No schema: the only thing this layer ever read
 * off one was a default label, and a label is a prop — the author writes it,
 * or a loader passes it from `displayName`. Options are the same, and belong
 * to the widgets that have them rather than to every binding.
 *
 * What it is *not* is a `Control` plus a hook: the scope is captured here, at
 * bind time, which is what keeps a staged-edit draft locked when its modal
 * renders outside the region the row was bound in.
 */
export interface FormField<T> {
  readonly control: Control<T>;
  state(rc: ReadContext): FieldState;
  /** Typed navigation into a compound value; arrays go through a collection. */
  readonly $: FormFields<T>;
}

// ── §4 Presence ──────────────────────────────────────────────────────

export type Presence = "rendered" | "silent" | "hidden";

// ── §5 Contract props ────────────────────────────────────────────────

export type Validator<T> = (
  value: T,
  rc: ReadContext,
) => string | null | undefined;

export interface FieldProps<T> {
  field: FormField<T>;
  id?: string;
  /**
   * The three per-control flags, one per `ControlDefinition` field. Presence
   * is NOT a prop — `hidden` narrows it, and only a container implementation
   * narrows it to `silent`.
   */
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  /** Static, like the JSON flag it mirrors. */
  dontClearHidden?: boolean;
  label?: FormProp<ReactNode>;
  required?: FormProp<boolean>;
  requiredMessage?: FormProp<string>;
  validate?: Validator<T> | Record<string, Validator<T>>;
  helpText?: FormProp<ReactNode>;
  startIcon?: FormProp<ReactNode>;
  endIcon?: FormProp<ReactNode>;
  className?: FormProp<ClassValue>;
  labelClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
}

/** What an implementation sees. Flat and resolved, so `<Shell {...p}>` composes. */
export interface FieldRenderProps<T> {
  field: FormField<T>;
  id: string;
  label?: ReactNode;
  required: boolean;
  /**
   * POC ADDITION (see README finding 2). The doc resolves the error in the
   * boundary but only names it on `FieldShellProps`, which leaves an
   * implementation nowhere to get it from. Carrying it here is also what makes
   * the documented `<Shell {...p}>` spread actually work.
   */
  error?: ReactNode;
  helpText?: ReactNode;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
  shellClassName?: ClassValue;
  textClassName?: ClassValue;
}

// ── §7 Structural primitives ─────────────────────────────────────────

export interface FieldShellProps {
  id: string;
  label?: ReactNode;
  labelAs?: "label" | "legend";
  /**
   * Where the label sits relative to the control. `"after"` also means the
   * shell may *wrap* the control, because that is how a trailing label
   * attaches in most libraries — an html `<label>` around the input, MUI's
   * `FormControlLabel` around both. Without it, every self-labelling widget
   * hand-rolls the label markup the shell already owns.
   */
  labelPosition?: "before" | "after";
  /**
   * POC ADDITION (see README finding 9). Does an `InputFrame` sit inside this
   * shell, or does the widget draw its own surface? MUI answers with two
   * different label components (`InputLabel` floats over a frame,
   * `FormLabel` sits above a radio group) and cannot tell from its children.
   * Defaults to `"custom"`, the safe half.
   */
  surface?: "frame" | "custom";
  orientation?: "vertical" | "horizontal";
  required?: boolean;
  /**
   * POC ADDITION (see README finding 3). MUI's `FormControl` greys its own
   * label and helper text from `disabled`; the shell is never told otherwise.
   */
  disabled?: boolean;
  helpText?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: ClassValue;
  labelClassName?: ClassValue;
}

export interface ControlSlotProps {
  id: string;
  ref?: Ref<any>;
  className?: string;
  /**
   * POC ADDITION (see README finding 11). §7 gives the slot a `className`
   * only, which assumes the implementation's styles exist as classes. Ant's
   * are runtime theme tokens, so its frame has nothing to put in a class name.
   */
  style?: CSSProperties;
  onFocus?: FocusEventHandler;
  onBlur?: FocusEventHandler;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

export interface FrameState {
  focused: boolean;
  filled: boolean;
  invalid: boolean;
  disabled: boolean;
  readOnly: boolean;
  multiline: boolean;
}

/**
 * Owns the mount lifetime of whatever a boundary would render. A slot rather
 * than a hard `visible ? children : null` because an exit transition needs the
 * subtree mounted while it leaves.
 */
export interface VisibilityProps {
  visible: boolean;
  children: ReactNode;
}

/** What an author writes on a group. Same three flags as a field. */
export interface GroupProps {
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  children: ReactNode;
}

/** Add / remove / move, plus the bounds the `Length` validator implies. */
export interface ArrayActions {
  length: number;
  canAdd: boolean;
  canRemove: boolean;
  add(value?: unknown, index?: number): void;
  remove(index: number): void;
  move(from: number, to: number): void;
}

/**
 * What an author writes on a collection. A `fieldRenderer` that happens to
 * take a render prop for its rows — not a framework component, which is what
 * `<Each>` used to be and why it missed validators, `clearHidden` and the
 * locks.
 */
export interface CollectionProps<T> extends FieldProps<T[]> {
  children: (item: FormField<T>, index: number) => ReactNode;
  empty?: ReactNode;
  /** Stand-in for the JSON `Length` validator; registered by the boundary. */
  minLength?: number;
  maxLength?: number;
}

/**
 * What a collection implementation receives. The three things that are easy to
 * get wrong — structure-only subscription, a tracking scope per element, keying
 * by `uniqueId` — are done before it sees them.
 */
export interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  elements: ReactNode[];
  actions: ArrayActions;
  empty?: ReactNode;
}

/** What a group implementation receives. */
export interface GroupRenderProps {
  className?: ClassValue;
  /**
   * Hide without unmounting. The children have to stay mounted — each clears
   * its own field — but plain JSX among them has nothing that suppresses
   * itself, so the *group* has to do it, and it must do it without changing
   * the element at that position or the subtree remounts.
   */
  hidden?: boolean;
  /** Only when the boundary was built with `{ scope: true }`. */
  invalid?: boolean;
  children: ReactNode;
}

export interface InputFrameProps {
  /**
   * POC ADDITION (see README finding 3). `ControlSlotProps` already carries
   * `id` and `aria-describedby` in §7, which only works if the frame is told
   * them — MUI's `OutlinedInput` takes both and passes them down itself.
   */
  id: string;
  describedBy?: string;
  render: (p: ControlSlotProps, s: FrameState) => ReactNode;
  start?: ReactNode | ((s: FrameState) => ReactNode);
  end?: ReactNode | ((s: FrameState) => ReactNode);
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  multiline?: boolean;
  /**
   * POC ADDITION (see README finding 3). §7 leaves open "whether `filled` can
   * be reported without the frame owning the value". It cannot: MUI's and
   * Mantine's floating/shrinking labels need it and the frame never sees a
   * value, so the caller tells it.
   */
  filled?: boolean;
  className?: ClassValue;
}

export interface StackProps {
  direction?: FormProp<"column" | "row">;
  gap?: FormProp<string | number>;
  justify?: FormProp<
    "start" | "center" | "end" | "space-between" | "space-around"
  >;
  align?: FormProp<"start" | "center" | "end" | "stretch" | "baseline">;
  wrap?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  children: ReactNode;
}

// ── §9 The registry ──────────────────────────────────────────────────

export interface TextFieldExtra {
  placeholder?: FormProp<string>;
  multiline?: FormProp<boolean>;
  inputType?: FormProp<"text" | "email" | "password" | "tel">;
}

export type TextFieldRenderProps = FieldRenderProps<string | undefined | null> &
  Resolved<TextFieldExtra>;

/** Closed and exhaustive. An implementation supplies every key. */
export type CheckboxRenderProps = FieldRenderProps<boolean | undefined | null>;

// ── Options ──────────────────────────────────────────────────────────

/**
 * The contract's own option type.
 *
 * Structurally what `SchemaField.options` carries, deliberately: the schema is
 * loader-only now (§3), so the contract has to declare this itself — but its
 * shape is still constrained by the format, or the loader would have to
 * re-map every option it passes through. `name`/`value`, not `label`/`id`.
 */
export interface FieldOption {
  name: string;
  value: string | number;
  disabled?: boolean;
}

export type OptionValue = string | number | undefined | null;

export type SelectExtra = { options?: FormProp<FieldOption[]> };

export type SelectRenderProps = FieldRenderProps<OptionValue> &
  Resolved<SelectExtra>;

// ── Displays ─────────────────────────────────────────────────────────

/**
 * A boundary with **no binding**. It keeps presence, the class slots and
 * design chrome, and drops everything that needs a field: validators,
 * `clearHidden`, the locks, `state(rc)`.
 */
export interface DisplayProps {
  hidden?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
  children?: ReactNode;
}

export interface DisplayRenderProps {
  className?: ClassValue;
  textClassName?: ClassValue;
  children?: ReactNode;
}

export type TextDisplayExtra = { text?: FormProp<ReactNode> };
export type HtmlDisplayExtra = { html?: FormProp<string> };

export type TextDisplayRenderProps = DisplayRenderProps &
  Resolved<TextDisplayExtra>;
export type HtmlDisplayRenderProps = DisplayRenderProps &
  Resolved<HtmlDisplayExtra>;

// ── Actions ──────────────────────────────────────────────────────────

export type ActionStyle = "primary" | "secondary" | "link";

/** What an author writes. */
export interface ActionProps {
  actionId: string;
  text?: FormProp<ReactNode>;
  icon?: FormProp<ReactNode>;
  onClick?: () => void | Promise<void>;
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  style?: FormProp<ActionStyle>;
  children?: ReactNode;
}

/**
 * What an implementation's button receives — resolved, and the same shape
 * whether it was dispatched for an authored `<Action>` or composed by another
 * renderer. Composition gets the chrome only: `busy`, the design-mode stub and
 * the disabled cascade come from the boundary.
 */
export interface ActionRenderProps {
  actionId: string;
  text?: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  style: ActionStyle;
  children?: ReactNode;
}

export interface FormRenderers {
  textfield: ComponentType<TextFieldRenderProps>;
  checkbox: ComponentType<CheckboxRenderProps>;
  select: ComponentType<SelectRenderProps>;
  action: ComponentType<ActionRenderProps>;
  text: ComponentType<TextDisplayRenderProps>;
  html: ComponentType<HtmlDisplayRenderProps>;
  contents: ComponentType<GroupRenderProps>;
  tabs: ComponentType<import("./tabs.js").TabsRenderProps>;
  wizard: ComponentType<import("./wizard.js").WizardRenderProps>;
  elements: ComponentType<CollectionRenderProps<any>>;
  fieldShell: ComponentType<FieldShellProps>;
  inputFrame: ComponentType<InputFrameProps>;
  visibility: ComponentType<VisibilityProps>;
  stack: ComponentType<StackProps>;
  /**
   * POC ADDITION (see README finding 1). Mantine needs `MantineProvider`, Ant
   * wants `ConfigProvider`, MUI wants a theme. An implementation is not just a
   * bag of components; it may need a root of its own, and the app should not
   * have to know which.
   */
  root?: ComponentType<{ children: ReactNode }>;
  /** For error messages and the demo switcher. */
  name: string;
}
