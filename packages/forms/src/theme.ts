import type { ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import type {
  FormStateNode,
  IconPlacement,
  IconReference,
} from "@rx-controls/forms-core";
import type { FormOptions } from "@rx-controls/forms-react-core";

/**
 * HTML theme — global class names + small behavior knobs threaded
 * through the renderer set via `HtmlFormOptions.theme`.
 *
 * This is the **resolved** theme: every slot is required. The framework
 * {@link import("./defaultTheme").defaultHtmlTheme} fills every one, so
 * renderers read `theme.X` directly and never carry a hardcoded fallback
 * class of their own. Slots with no default styling are set to `""`;
 * genuinely-absent-by-default values (a default action icon, the optional
 * custom-render hook) are `null`.
 *
 * Hosts customise by passing a {@link PartialHtmlFormTheme} via
 * `<Form options={{ theme }}>` — it is deep-merged over the default (see
 * {@link import("./defaultTheme").deepMergeTheme}). Only the slots the host
 * specifies override; everything else keeps the default.
 *
 * Each leaf class is merged with the per-control class from the form
 * definition (`ControlDefinition.styleClass`, `textClass`, `labelClass`,
 * `labelTextClass`, `layoutClass`) using `rendererClass()` semantics —
 * by default they merge; prefix either with `@ ` to opt out and override.
 */
export interface HtmlFormTheme {
  /** Form-wide chrome. */
  layout: HtmlLayoutTheme;
  label: HtmlLabelTheme;
  error: HtmlErrorTheme;

  /** Renderer kinds. */
  data: HtmlDataTheme;
  group: HtmlGroupTheme;
  action: HtmlActionTheme;
  display: HtmlDisplayTheme;
  adornment: HtmlAdornmentTheme;
}

/**
 * Deep-partial of the resolved theme — the shape a host supplies to
 * customise. Any subset of slots at any depth; unspecified slots keep the
 * default. Functions, arrays, and primitives are treated as atomic leaves.
 */
export type PartialHtmlFormTheme = DeepPartial<HtmlFormTheme>;

export type DeepPartial<T> = T extends
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly unknown[]
      ? T
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

// ── Chrome ───────────────────────────────────────────────────────────

export interface HtmlLayoutTheme {
  /** Default <Layout> wrapper class (combined with the control's
   * `layoutClass`). */
  className: string;
}

export interface HtmlLabelTheme {
  /** Class on the <label> element (combined with the control's
   * `labelClass`). */
  className: string;
  /** Class on the label text wrapper (combined with the control's
   * `labelTextClass`). */
  textClass: string;
  /** Class on the required-indicator span. */
  requiredClass: string;
  /** Content of the required-indicator span. Defaults to `"*"`. Pass an
   * empty string to suppress the visible asterisk (the span is still
   * rendered with `requiredClass` so host CSS can position / decorate
   * the indicator without renderer changes — matches the legacy
   * `<span class="text-red-500"></span>` shape). */
  requiredText: ReactNode;
  /** Additional class on the <label> when the rendered control is
   * group-shaped — true for `type: "Group"` definitions and for compound
   * Data controls with `renderOptions.type === "Group"`. Layered on top
   * of `className` and the control's `labelClass`. Mirrors the legacy
   * `DefaultRendererOptions.label.groupLabelClass` slot. */
  groupClassName: string;
}

export interface HtmlErrorTheme {
  /** Class on the error element (`<span>` for single, `<ul>` for `all`). */
  className: string;
  /** Class on each `<li>` when rendering all errors. */
  itemClass: string;
}

// ── Data renderers ───────────────────────────────────────────────────

export interface HtmlDataTheme {
  /** Class applied to single-line text-shaped inputs (textfield, number,
   * date, time, datetime). Combined with the control's `styleClass`. */
  inputClass: string;
  /** Reserved for renderers that emit a separate text element alongside
   * the input (e.g. legacy textClass slot). Currently unused — kept for
   * forward compatibility. */
  inputTextClass: string;
  /** Class for the <DisplayOnlyRenderer> output. */
  displayOnlyClass: string;

  /** Class for the <ElementSelectedRenderer> wrapper. */
  elementSelectedClass: string;

  multiline: HtmlMultilineTheme;
  checkbox: HtmlCheckboxTheme;
  select: HtmlSelectTheme;
  radio: HtmlOptionGroupTheme;
  checkList: HtmlOptionGroupTheme;
  autocomplete: HtmlAutocompleteTheme;
  array: HtmlArrayTheme;
  arrayElement: HtmlArrayElementTheme;
  scrollList: HtmlScrollListTheme;
}

export interface HtmlArrayElementTheme {
  className: string;
  summaryClass: string;
  buttonClass: string;
  dialogClass: string;
  innerClass: string;
}

export interface HtmlScrollListTheme {
  className: string;
  spinnerClass: string;
}

export interface HtmlMultilineTheme {
  className: string;
}

export interface HtmlCheckboxTheme {
  /** Wrapper around the checkbox + its inline label. */
  className: string;
  /** The <input type="checkbox"> itself. */
  inputClass: string;
}

export interface HtmlSelectTheme {
  className: string;
  /** Placeholder text for the empty option (defaults to "—"). */
  emptyText: ReactNode;
  /** Placeholder text shown when the field is required (defaults to "—"). */
  requiredText: ReactNode;
}

export interface HtmlOptionGroupTheme {
  /** Outer fieldset wrapper. */
  className: string;
  /** Per-option wrapper around the input+label and any per-option
   * children (description/image etc.). Layered with the per-control
   * `renderOptions.entryWrapperClass` from the form definition. */
  entryWrapperClass: string;
  /** Class applied to the per-option wrapper when that option is
   * currently checked. Layered with `renderOptions.selectedClass`. */
  selectedClass: string;
  /** Class applied to the per-option wrapper when that option is
   * currently NOT checked. Layered with `renderOptions.notSelectedClass`. */
  notSelectedClass: string;
  /** Each row (label + input). */
  entryClass: string;
  /** The <input>. */
  inputClass: string;
  /** The inline label. */
  labelClass: string;
}

export interface HtmlAutocompleteTheme {
  className: string;
  inputClass: string;
  listClass: string;
  optionClass: string;
  activeOptionClass: string;
}

export interface HtmlArrayTheme {
  className: string;
  childClass: string;
  removableChildClass: string;
  addClass: string;
  removeClass: string;
  /** Class for the per-row Edit button (editExternal mode). */
  editClass: string;
  /** `<dialog>` chrome for the external-edit add modal. */
  dialogClass: string;
  /** Inner wrapper inside the add modal (padding + child layout). */
  dialogBodyClass: string;
  /** Class for the actions (Cancel/confirm) footer row in the add modal. */
  actionsClass: string;
  /** Class for the Cancel button in the add modal. */
  cancelClass: string;
}

// ── Group renderers ──────────────────────────────────────────────────

export interface HtmlGroupTheme {
  /** Default group wrapper (Standard/Inline/Contents inherit). */
  className: string;
  standardClass: string;
  inlineClass: string;
  flexClass: string;
  defaultFlexGap: string;
  grid: HtmlGridTheme;
  tabs: HtmlTabsTheme;
  accordion: HtmlAccordionGroupTheme;
  dialog: HtmlDialogTheme;
  wizard: HtmlWizardTheme;
}

export interface HtmlWizardTheme {
  className: string;
  stepListClass: string;
  stepClass: string;
  stepActiveClass: string;
  stepDoneClass: string;
  stepPendingClass: string;
  stepInvisibleClass: string;
  navClass: string;
  buttonClass: string;
}

export interface HtmlGridTheme {
  className: string;
  defaultColumns: number;
  rowClass: string;
  cellClass: string;
}

export interface HtmlTabsTheme {
  className: string;
  tabListClass: string;
  tabClass: string;
  activeTabClass: string;
  inactiveTabClass: string;
  contentClass: string;
}

export interface HtmlAccordionGroupTheme {
  className: string;
  sectionClass: string;
  titleClass: string;
  contentClass: string;
}

export interface HtmlDialogTheme {
  className: string;
  titleClass: string;
  containerClass: string;
}

// ── Action renderers ─────────────────────────────────────────────────

export interface HtmlActionTheme {
  /** Layout class for non-Link / non-Group `<button>`. Defaults to
   * `"inline-flex items-center justify-center gap-1.5"` so icon + text
   * compose cleanly. Set to `""` to opt out entirely (e.g. when the
   * legacy form definition supplies a block-level button shape via
   * `buttonClass`). */
  buttonLayoutClass: string;
  /** Layout class for `ActionStyle.Link` `<button>`. Defaults to
   * `"inline-flex items-center gap-1"`. Set to `""` to render the link
   * as a pure inline element with no flex container — required for
   * inline-text links that need to flow as part of surrounding text. */
  linkLayoutClass: string;
  /** Base class always applied to the `<button>`, layered beneath the
   * variant class (primary/secondary/link/group). */
  buttonClass: string;
  /** Base class applied to the text `<span>`, layered beneath the
   * variant text class. */
  textClass: string;
  primaryClass: string;
  primaryTextClass: string;
  secondaryClass: string;
  secondaryTextClass: string;
  linkClass: string;
  linkTextClass: string;
  /** Wrapper class for `ActionStyle.Group` buttons (action bars / icon
   * groups). */
  groupClass: string;
  iconBeforeClass: string;
  iconAfterClass: string;
  /** Default icon used when the action definition does not specify one.
   * `null` means no default icon. */
  icon: IconReference | null;
  /** Icon shown while the action is busy (e.g. spinner). When set,
   * replaces the resting icon for the duration of the async action.
   * `null` means no busy icon. */
  busyIcon: IconReference | null;
  /** Placement for `busyIcon`. Defaults to `ReplaceText` so a spinner
   * takes the place of the label, matching legacy behaviour. */
  busyIconPlacement: IconPlacement;
}

// ── Display renderers ────────────────────────────────────────────────

export interface HtmlDisplayTheme {
  textClass: string;
  htmlClass: string;
  iconClass: string;
}

// ── Adornments ───────────────────────────────────────────────────────

export interface HtmlAdornmentTheme {
  helpText: HtmlHelpTextTheme;
  optional: HtmlOptionalAdornmentTheme;
  accordion: HtmlAccordionAdornmentTheme;
}

export interface HtmlHelpTextTheme {
  triggerClass: string;
  triggerLabelClass: string;
  contentClass: string;
  contentTextClass: string;
  iconClass: string;
  /** Wrapper for inline (label/control placement) help text. */
  inlineClass: string;
  /** Wrapper for block (above/below) help text. */
  blockClass: string;
}

export interface HtmlOptionalAdornmentTheme {
  className: string;
  checkClass: string;
  childWrapperClass: string;
  nullWrapperClass: string;
  labelWrapClass: string;
  setNullText: ReactNode;
  /** Replaces the default control-slot body. `null` uses the default
   * rendering. When set, receives the resolved data + editing controls,
   * current `isNull` / `isEditing` / disabled state, the wrapped field
   * (`children`), and the `defaultBody` that the adornment would
   * otherwise render. Hosts can return either:
   *   - the `defaultBody` to fall through to the normal rendering, or
   *   - a custom node (e.g. a "Differing values" summary when several
   *     records are being bulk-edited) — they're responsible for
   *     re-emitting the field if they want it shown.
   *
   * Multi-value detection lives in the host: the adornment exposes the
   * data control so a host that maintains its own bulk-edit projection
   * (e.g. a `Control<unknown[]>` of distinct values stored in `meta`)
   * can read it inside `customRender` and branch on it. */
  customRender: ((props: OptionalCustomRenderProps) => ReactNode) | null;
}

export interface OptionalCustomRenderProps {
  node: FormStateNode;
  /** Data control bound to this node. Same one the adornment writes
   * to when the null toggle flips. */
  data: Control<unknown>;
  /** Per-node editing toggle (`true` = editing). Persisted on the
   * FormStateNode meta under `$optional/editing`. */
  editing: Control<boolean>;
  /** `data.value == null`, evaluated against the active read context. */
  isNull: boolean;
  /** Current value of `editing`, evaluated against the active read context. */
  isEditing: boolean;
  /** Whether the inner field is force-disabled by the adornment.
   * Already applied to the FormStateNode — provided for hosts that
   * want to mirror the styling. */
  shouldDisable: boolean;
  /** The wrapped renderer output (the field itself). */
  children: ReactNode;
  /** Pre-rendered null toggle row (`null` if `allowNull` is off). */
  nullToggle: ReactNode | null;
  /** What the adornment would have rendered if `customRender` were
   * unset. Return this to fall through. */
  defaultBody: ReactNode;
}

export interface HtmlAccordionAdornmentTheme {
  /** Outer `<div>` wrapping the toggler + content region. The renderer
   * emits a single root element so the adornment behaves as one item
   * inside flex/grid groups; this slot styles that wrapper. */
  wrapperClass: string;
  /** Toggler `<button>` class. */
  className: string;
  /** Class applied to the title text. */
  titleClass: string;
  /** Class applied to the chevron `<i>` element. */
  togglerClass: string;
  /** Icon shown when the accordion is open. Defaults to FA `chevron-up`. */
  iconOpen: IconReference;
  /** Icon shown when the accordion is closed. Defaults to FA `chevron-down`. */
  iconClosed: IconReference;
  /** Class wrapping the revealed content. */
  contentClass: string;
}

// ── HtmlFormOptions ──────────────────────────────────────────────────

/**
 * HTML platform's `FormOptions` — extends the headless slot set with a
 * `theme` tree. Pass a {@link PartialHtmlFormTheme} via
 * `<Form options={...}>`; nested `<OptionsProvider value={...}>` rescopes
 * for a subtree. The theme is deep-merged over {@link
 * import("./defaultTheme").defaultHtmlTheme} at read time.
 */
export interface HtmlFormOptions extends FormOptions {
  theme?: PartialHtmlFormTheme;
  /**
   * When true, `<DefaultError>` renders every error message attached to
   * the bound data control. Default `false` shows only the first error.
   * Per-Field overrides can still pass `all` directly to a custom error
   * component, or to `<DefaultError all />`.
   */
  showAllErrors?: boolean;
}
