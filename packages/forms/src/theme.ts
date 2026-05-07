import type { ReactNode } from "react";
import type { Control } from "@rxc/controls-core";
import type {
  FormStateNode,
  IconPlacement,
  IconReference,
} from "@rxc/forms-core";
import type { FormOptions } from "@rxc/forms-react-core";

/**
 * HTML theme — global class names + small behavior knobs threaded
 * through the renderer set via `HtmlFormOptions.theme`.
 *
 * Each leaf class is merged with the per-control class from the form
 * definition (`ControlDefinition.styleClass`, `textClass`, `labelClass`,
 * `labelTextClass`, `layoutClass`) using `rendererClass()` semantics —
 * by default they merge; prefix either with `@ ` to opt out and override.
 *
 * Hosts that want a single drop-in look (Tailwind preset, etc.) build
 * one of these and pass it via `<Form options={{ theme }}>`. Subtree
 * rescoping works by nesting `<OptionsProvider>`.
 */
export interface HtmlFormTheme {
  /** Form-wide chrome. */
  layout?: HtmlLayoutTheme;
  label?: HtmlLabelTheme;
  error?: HtmlErrorTheme;

  /** Renderer kinds. */
  data?: HtmlDataTheme;
  group?: HtmlGroupTheme;
  action?: HtmlActionTheme;
  display?: HtmlDisplayTheme;
  adornment?: HtmlAdornmentTheme;
}

// ── Chrome ───────────────────────────────────────────────────────────

export interface HtmlLayoutTheme {
  /** Default <Layout> wrapper class (combined with the control's
   * `layoutClass`). */
  className?: string;
}

export interface HtmlLabelTheme {
  /** Class on the <label> element (combined with the control's
   * `labelClass`). */
  className?: string;
  /** Class on the label text wrapper (combined with the control's
   * `labelTextClass`). */
  textClass?: string;
  /** Class on the required-asterisk span. */
  requiredClass?: string;
}

export interface HtmlErrorTheme {
  /** Class on the error element (`<span>` for single, `<ul>` for `all`). */
  className?: string;
  /** Class on each `<li>` when rendering all errors. */
  itemClass?: string;
}

// ── Data renderers ───────────────────────────────────────────────────

export interface HtmlDataTheme {
  /** Class applied to single-line text-shaped inputs (textfield, number,
   * date, time, datetime). Combined with the control's `styleClass`. */
  inputClass?: string;
  /** Reserved for renderers that emit a separate text element alongside
   * the input (e.g. legacy textClass slot). Currently unused — kept for
   * forward compatibility. */
  inputTextClass?: string;
  /** Class for the <DisplayOnlyRenderer> output. */
  displayOnlyClass?: string;

  multiline?: HtmlMultilineTheme;
  bool?: HtmlBoolTheme;
  select?: HtmlSelectTheme;
  radio?: HtmlOptionGroupTheme;
  checkList?: HtmlOptionGroupTheme;
  autocomplete?: HtmlAutocompleteTheme;
  array?: HtmlArrayTheme;
}

export interface HtmlMultilineTheme {
  className?: string;
}

export interface HtmlBoolTheme {
  /** Wrapper around the checkbox + its inline label. */
  className?: string;
  /** The <input type="checkbox"> itself. */
  inputClass?: string;
  /** The inline label text. */
  labelClass?: string;
}

export interface HtmlSelectTheme {
  className?: string;
  /** Placeholder text for the empty option (defaults to "Select…"). */
  emptyText?: string;
  /** Placeholder text shown when the field is required. */
  requiredText?: string;
}

export interface HtmlOptionGroupTheme {
  /** Outer fieldset wrapper. */
  className?: string;
  /** Each row (label + input). */
  entryClass?: string;
  /** The <input>. */
  inputClass?: string;
  /** The inline label. */
  labelClass?: string;
}

export interface HtmlAutocompleteTheme {
  className?: string;
  inputClass?: string;
  listClass?: string;
  optionClass?: string;
  activeOptionClass?: string;
}

export interface HtmlArrayTheme {
  className?: string;
  childClass?: string;
  removableChildClass?: string;
  addClass?: string;
  removeClass?: string;
}

// ── Group renderers ──────────────────────────────────────────────────

export interface HtmlGroupTheme {
  /** Default group wrapper (Standard/Inline/Contents inherit). */
  className?: string;
  standardClass?: string;
  inlineClass?: string;
  flexClass?: string;
  defaultFlexGap?: string;
  grid?: HtmlGridTheme;
  tabs?: HtmlTabsTheme;
  accordion?: HtmlAccordionGroupTheme;
  dialog?: HtmlDialogTheme;
}

export interface HtmlGridTheme {
  className?: string;
  defaultColumns?: number;
  rowClass?: string;
  cellClass?: string;
}

export interface HtmlTabsTheme {
  className?: string;
  tabListClass?: string;
  tabClass?: string;
  activeTabClass?: string;
  inactiveTabClass?: string;
  contentClass?: string;
}

export interface HtmlAccordionGroupTheme {
  className?: string;
  titleClass?: string;
  contentClass?: string;
}

export interface HtmlDialogTheme {
  className?: string;
  titleClass?: string;
  containerClass?: string;
}

// ── Action renderers ─────────────────────────────────────────────────

export interface HtmlActionTheme {
  /** Base class always applied to the `<button>`, layered beneath the
   * variant class (primary/secondary/link/group). */
  buttonClass?: string;
  /** Base class applied to the text `<span>`, layered beneath the
   * variant text class. */
  textClass?: string;
  primaryClass?: string;
  primaryTextClass?: string;
  secondaryClass?: string;
  secondaryTextClass?: string;
  linkClass?: string;
  linkTextClass?: string;
  /** Wrapper class for `ActionStyle.Group` buttons (action bars / icon
   * groups). */
  groupClass?: string;
  iconBeforeClass?: string;
  iconAfterClass?: string;
  /** Default icon used when the action definition does not specify one. */
  icon?: IconReference;
  /** Icon shown while the action is busy (e.g. spinner). When set,
   * replaces the resting icon for the duration of the async action. */
  busyIcon?: IconReference;
  /** Placement for `busyIcon`. Defaults to `ReplaceText` so a spinner
   * takes the place of the label, matching legacy behaviour. */
  busyIconPlacement?: IconPlacement;
}

// ── Display renderers ────────────────────────────────────────────────

export interface HtmlDisplayTheme {
  textClass?: string;
  htmlClass?: string;
  iconClass?: string;
}

// ── Adornments ───────────────────────────────────────────────────────

export interface HtmlAdornmentTheme {
  helpText?: HtmlHelpTextTheme;
  optional?: HtmlOptionalAdornmentTheme;
  accordion?: HtmlAccordionAdornmentTheme;
}

export interface HtmlHelpTextTheme {
  triggerClass?: string;
  triggerLabelClass?: string;
  contentClass?: string;
  contentTextClass?: string;
  iconClass?: string;
}

export interface HtmlOptionalAdornmentTheme {
  className?: string;
  checkClass?: string;
  childWrapperClass?: string;
  nullWrapperClass?: string;
  setNullText?: string;
  /** Replaces the default control-slot body. Receives the resolved
   * data + editing controls, current `isNull` / `isEditing` / disabled
   * state, the wrapped field (`children`), and the `defaultBody` that
   * the adornment would otherwise render. Hosts can return either:
   *   - the `defaultBody` to fall through to the normal rendering, or
   *   - a custom node (e.g. a "Differing values" summary when several
   *     records are being bulk-edited) — they're responsible for
   *     re-emitting the field if they want it shown.
   *
   * Multi-value detection lives in the host: the adornment exposes the
   * data control so a host that maintains its own bulk-edit projection
   * (e.g. a `Control<unknown[]>` of distinct values stored in `meta`)
   * can read it inside `customRender` and branch on it. */
  customRender?: (props: OptionalCustomRenderProps) => ReactNode;
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
  className?: string;
  titleClass?: string;
  togglerClass?: string;
}

// ── HtmlFormOptions ──────────────────────────────────────────────────

/**
 * HTML platform's `FormOptions` — extends the headless slot set with a
 * `theme` tree. Pass via `<Form options={...}>`; nested
 * `<OptionsProvider value={...}>` rescopes for a subtree.
 */
export interface HtmlFormOptions extends FormOptions {
  theme?: HtmlFormTheme;
  /**
   * When true, `<Error>` renders every error message attached to the
   * bound data control. Default `false` shows only the first error.
   * Per-Field overrides can still pass `<Error all>` directly.
   */
  showAllErrors?: boolean;
}
