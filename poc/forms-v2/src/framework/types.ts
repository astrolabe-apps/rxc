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
/**
 * Renderer-specific props reach the implementation **as the author wrote
 * them** — a `FormProp` still a `FormProp`, resolved by the implementation
 * with `getProp` in its own tracking window. The boundary cannot resolve them
 * for it: it has no way to tell `(rc) => T` from a callback like
 * `(index) => void`, and would invoke the callback with an `rc`. Since a
 * `FormProp` is read in the consuming component's window everywhere else,
 * this is the same rule, not an exception to it.
 */

// ── §2 Class values ──────────────────────────────────────────────────

export type ClassValue = string | { replace: string };

// ── §3 The binding ───────────────────────────────────────────────

export interface FieldState {
  disabled: boolean;
  readOnly: boolean;
  touched: boolean;
  dirty: boolean;
  errors: string[];
}

/**
 * The binding is a plain `Control<T>`; there is no handle around it. `state`
 * is what a `Control` cannot answer alone — `readOnly` has no home on one, and
 * `disabled` folds in the enclosing scope's — so it is a function of the
 * control *and* the scope where the field is rendered (`fieldState` /
 * `useFieldState` in scope.tsx), not a method on the binding. Typed
 * navigation is `control.fields.x`. No schema: the only thing this layer ever
 * read off one was a default label, and a label is a prop.
 *
 * A scoped handle (`FormField<T>` = `{ control, state(rc), $ }`) was built and
 * removed — README finding 19.
 */

// ── §4 Presence ──────────────────────────────────────────────────────

export type Presence = "rendered" | "silent" | "hidden";

// ── §5 Contract props ────────────────────────────────────────────────

export type ValidatorResult = string | null | undefined;

/**
 * Sync or async. A promise publishes when it resolves; a run superseded by a
 * newer one is dropped. Reads through `rc` **before the first `await`** are
 * tracked and re-run the validator when they move; reads after it are not.
 * No debounce — wrap the function if a call is expensive.
 */
export type Validator<T> = (
  value: T,
  rc: ReadContext,
) => ValidatorResult | Promise<ValidatorResult>;

export interface FieldProps<T> {
  field: Control<T>;
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
  /**
   * The label's *text*, as distinct from its container — the same View/Text
   * split `className` / `textClassName` already make for the control, and
   * needed for the same reason: on React Native text styles do not cascade
   * from a View. An implementation whose label is a single text element may
   * apply it together with `labelClassName`.
   */
  labelTextClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
}

/** What an implementation sees. Flat and resolved, so `<Shell {...p}>` composes. */
export interface FieldRenderProps<T> {
  field: Control<T>;
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
  /** Inside an inline container: draw a bare span, no shell (README finding 60). */
  inline?: boolean;
  className?: ClassValue;
  labelClassName?: ClassValue;
  labelTextClassName?: ClassValue;
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
  /** The label's text; a single-element label merges it with `labelClassName`. */
  labelTextClassName?: ClassValue;
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
  /** A heading over the content; absent means none. */
  title?: FormProp<ReactNode>;
  /**
   * The same five slots a field has, for the same anatomy: the wrapper
   * (`shellClassName`), the title's container and text (`labelClassName`,
   * `labelTextClassName`) and the body (`className`). Legacy styled groups
   * against all of them — 224 `layoutClass`, 127 `labelTextClass`, 39
   * `labelClass` in the corpus — and the contract had only the body
   * (README finding 63).
   */
  className?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
  labelClassName?: FormProp<ClassValue>;
  labelTextClassName?: FormProp<ClassValue>;
  children: ReactNode;
}

/**
 * Add / remove / move / edit, plus the bounds the `Length` validator implies.
 * The collection boundary builds these with its own scope, so a locked region
 * reports every `can*` false; `edit` stages a draft through the external-edit
 * controller and records that scope as the session's origin, which is what
 * closes the dialog if the region locks mid-edit.
 */
export interface ArrayActions {
  length: number;
  canAdd: boolean;
  canRemove: boolean;
  canEdit: boolean;
  add(value?: unknown, index?: number): void;
  remove(index: number): void;
  move(from: number, to: number): void;
  /** Begin a staged edit of one element. The dialog is hosted elsewhere. */
  edit(index: number): void;
}

/**
 * What an author writes on a collection. A `fieldRenderer` that happens to
 * take a render prop for its rows — not a framework component, which is what
 * `<Each>` used to be and why it missed validators, `clearHidden` and the
 * locks.
 */
export interface CollectionProps<T> extends FieldProps<T[]> {
  /** The row. `actions` are the boundary's own — the scope-aware set. */
  children: (
    item: Control<T>,
    index: number,
    actions: ArrayActions,
  ) => ReactNode;
  empty?: ReactNode;
  /** Stand-in for the JSON `Length` validator; registered by the boundary. */
  minLength?: number;
  maxLength?: number;
}

/**
 * One element, as the implementation sees it. `node` is the author's row,
 * already rendered in its own tracking scope; the rest is what an
 * implementation needs to put chrome *on* that row — a DataGrid's remove
 * column, a card's Edit button — which an opaque `ReactNode[]` could not
 * carry. `field` is the element's control.
 */
export interface CollectionElement<T> {
  key: number;
  index: number;
  field: Control<T>;
  node: ReactNode;
}

/**
 * What a collection implementation receives. The three things that are easy to
 * get wrong — structure-only subscription, a tracking scope per element, keying
 * by `uniqueId` — are done before it sees them.
 */
export interface CollectionRenderProps<T> extends FieldRenderProps<T[]> {
  elements: CollectionElement<T>[];
  actions: ArrayActions;
  empty?: ReactNode;
}

/** What a group implementation receives. */
export interface GroupRenderProps {
  title?: ReactNode;
  /** The body. */
  className?: ClassValue;
  /** The wrapper around title and body. */
  shellClassName?: ClassValue;
  /** The title's container and its text; a single-element title merges the pair. */
  labelClassName?: ClassValue;
  labelTextClassName?: ClassValue;
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
  TextFieldExtra;

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
  /**
   * `boolean` because the corpus says so: legacy's `FieldOption.value` is
   * `any`, and its `AllowedOptions` expressions build Yes/No radios over
   * `Bool` fields as `[{ name: "Yes", value: true }, …]` (README finding 59).
   * The DOM erases all three to strings; the controller round-trips through
   * the option list, so nothing else changes.
   */
  value: string | number | boolean;
  disabled?: boolean;
}

export type OptionValue = string | number | boolean | undefined | null;

export type SelectExtra = { options?: FormProp<FieldOption[]> };

export type SelectRenderProps = FieldRenderProps<OptionValue> & SelectExtra;

/**
 * Radio: the same options widget with one more thing legacy asks of it —
 * **per-option content**. Legacy spawns the definition's children once per
 * option with `formData.option` / `formData.optionSelected` in scope (6 of
 * the corpus's 69 radios use it: a description under each choice, a detail
 * group shown under the chosen one). In JSX that is a render prop, like a
 * collection's row. Rendered for **every** option, selected or not — gate
 * with `<Contents hidden={!selected}>`, never `selected && …`, or the field
 * inside unmounts and stops validating (README finding 56).
 */
export interface RadioExtra extends SelectExtra {
  children?: (option: FieldOption, selected: boolean) => ReactNode;
  /** Legacy's `CheckEntryClasses`: the wrapper around each option, and its two states. */
  entryClassName?: FormProp<ClassValue>;
  selectedClassName?: FormProp<ClassValue>;
  notSelectedClassName?: FormProp<ClassValue>;
}

export type RadioRenderProps = FieldRenderProps<OptionValue> & RadioExtra;

// ── Display-only ─────────────────────────────────────────────────────

/**
 * A bound field that shows its value as text and never edits it — legacy's
 * `DisplayOnly` render type, 372 uses across 52 corpus forms. A **field**
 * boundary, not a display one: it binds data, so `hidden` clears it and it
 * attaches to the validation scope like any field, and it sits in the shell
 * with a label. `required` means nothing on it and the loader drops it, as
 * legacy did.
 */
export interface DisplayOnlyExtra {
  /** Value → name, like Select. Applied per element for an array. */
  options?: FormProp<FieldOption[]>;
  /** Shown when the value is empty. */
  emptyText?: FormProp<ReactNode>;
  /** Shown in design mode when the value is empty — what the designer sees. */
  sampleText?: FormProp<ReactNode>;
  /**
   * One non-option value as text. Default `String(v)`; an array is mapped and
   * joined with ", ". The loader builds one from the schema type (dates,
   * booleans); a JSX author passes their own or none.
   */
  format?: (value: unknown) => string;
  /** Not selectable — legacy's `noSelection`. */
  noSelection?: boolean;
}

export type DisplayOnlyRenderProps = FieldRenderProps<unknown> &
  DisplayOnlyExtra;

// ── Displays ─────────────────────────────────────────────────────────

/**
 * A boundary with **no binding**. It keeps presence, the class slots and
 * design chrome, and drops everything that needs a field: validators,
 * `clearHidden`, the locks, the field state.
 */
export interface DisplayProps {
  hidden?: FormProp<boolean>;
  /**
   * Where the legacy `Tooltip` adornment lands. An accessible name is text —
   * redundant on a display that already renders text, load-bearing on one
   * that does not (an icon). Whether it is *also* visible is the
   * implementation's call: a `title`, its own Tooltip, or nothing.
   */
  accessibleName?: FormProp<string>;
  /** The element, its text, and the wrapper around it — legacy's three (finding 63). */
  className?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
  children?: ReactNode;
}

export interface DisplayRenderProps {
  accessibleName?: string;
  /** Inside an inline container: a span in prose, not a block. */
  inline?: boolean;
  className?: ClassValue;
  textClassName?: ClassValue;
  shellClassName?: ClassValue;
  children?: ReactNode;
}

export type TextDisplayExtra = { text?: FormProp<ReactNode> };
export type HtmlDisplayExtra = { html?: FormProp<string> };
/** A named glyph. The implementation decides what draws it. */
export type IconDisplayExtra = { icon?: FormProp<string> };

export type TextDisplayRenderProps = DisplayRenderProps & TextDisplayExtra;
export type HtmlDisplayRenderProps = DisplayRenderProps & HtmlDisplayExtra;
export type IconDisplayRenderProps = DisplayRenderProps & IconDisplayExtra;

// ── Actions ──────────────────────────────────────────────────────────

export type ActionStyle = "primary" | "secondary" | "link";
export type IconPlacement = "before" | "after" | "replace";
/**
 * What a running async handler locks: nothing, this button, or the whole form.
 * A JSX author asks for this by hand — "disable everything while this saves"
 * — so it is a contract prop, where `actionData` (JSON's stand-in for a
 * closure) is not.
 */
export type DisableType = "none" | "self" | "global";

/** What an author writes. */
export interface ActionProps {
  actionId: string;
  text?: FormProp<ReactNode>;
  icon?: FormProp<ReactNode>;
  iconPlacement?: FormProp<IconPlacement>;
  onClick?: () => void | Promise<void>;
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  disableType?: DisableType;
  style?: FormProp<ActionStyle>;
  /** The button, its text, and the wrapper around it (finding 63). */
  className?: FormProp<ClassValue>;
  textClassName?: FormProp<ClassValue>;
  shellClassName?: FormProp<ClassValue>;
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
  /** Absent means `"before"` — a composed button need not say. */
  iconPlacement?: IconPlacement;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  style: ActionStyle;
  className?: ClassValue;
  textClassName?: ClassValue;
  shellClassName?: ClassValue;
  children?: ReactNode;
}

export interface FormRenderers {
  textfield: ComponentType<TextFieldRenderProps>;
  checkbox: ComponentType<CheckboxRenderProps>;
  select: ComponentType<SelectRenderProps>;
  radio: ComponentType<RadioRenderProps>;
  displayOnly: ComponentType<DisplayOnlyRenderProps>;
  action: ComponentType<ActionRenderProps>;
  text: ComponentType<TextDisplayRenderProps>;
  html: ComponentType<HtmlDisplayRenderProps>;
  icon: ComponentType<IconDisplayRenderProps>;
  contents: ComponentType<GroupRenderProps>;
  /** Legacy's Inline group: a bare span whose children render inline. */
  inline: ComponentType<GroupRenderProps>;
  tabs: ComponentType<import("./tabs.js").TabsRenderProps>;
  wizard: ComponentType<import("./wizard.js").WizardRenderProps>;
  dialog: ComponentType<import("./dialog.js").DialogRenderProps>;
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
