import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  countText,
  fieldCountId,
  describedBy,
  fieldErrorId,
  fieldLabelId,
  fieldHelpId,
  getProp,
  useFieldShell,
  useDisplayValue,
  type DisplayOnlyRenderProps,
  useInputFrame,
  Action,
  StandardActionIds,
  useCheckbox,
  useSelectController,
  useMultiSelectController,
  useTextInput,
  type ActionRenderProps,
  type VisibilityProps,
  type HtmlDisplayRenderProps,
  type IconDisplayRenderProps,
  type TextDisplayRenderProps,
  type CheckboxRenderProps,
  type SelectRenderProps,
  type RadioRenderProps,
  type CheckListRenderProps,
  type FieldShellProps,
  type FormRenderers,
  type FrameState,
  type InputFrameProps,
  type TabsRenderProps,
  type WizardRenderProps,
  type DialogRenderProps,
  type DisclosureRenderProps,
  type TextFieldRenderProps,
  type GroupRenderProps,
  type CollectionRenderProps,
  combineClass,
  type RichTextRenderProps,
  type ImageDisplayRenderProps,
  helpButtonName,
  type IconSpec,
  type FeedRenderProps,
} from "@rx-controls/forms-react";
import {
  ContentsRegion,
  Inline,
  ElementsList,
  DefaultVisibility,
  FadeVisibility,
  FormElement,
  DisplayShell,
  noContent,
  onFocusLeave,
  optionKeys,
  RequiredNote,
  requiredDescribedBy,
  labelEndHelp,
  visuallyHiddenStyle,
  RichTextDom,
  ImageDom,
  lookParts,
  lookClass,
  lookAttr,
  portableCss,
  portableCssSplit,
  useLookStyles,
  useWebIcon,
  FeedList,
} from "./shared.js";
import { useHtmlTheme, type HtmlTheme } from "./theme.js";

// ── Shell: family 1 (children-hosting, class-driven — Bootstrap / shadcn) ──

type ShellTheme = HtmlTheme["shell"];
/** Each theme's shell per widget, merged once. */
const shellsFor = new WeakMap<HtmlTheme, Map<string, ShellTheme>>();

/** The shell slots for a widget: `shellFor[widget]` over `shell`. */
function shellOf(theme: HtmlTheme, widget: string | undefined): ShellTheme {
  const over = widget === undefined ? undefined : theme.shellFor[widget];
  if (!over) return theme.shell;
  let cache = shellsFor.get(theme);
  if (!cache) shellsFor.set(theme, (cache = new Map()));
  let merged = cache.get(widget!);
  if (!merged) {
    merged = {
      ...theme.shell,
      ...(over as Partial<ShellTheme>),
      required: { ...theme.shell.required, ...over.required },
    };
    cache.set(widget!, merged);
  }
  return merged;
}

function HtmlFieldShell(p: FieldShellProps) {
  const icon = useWebIcon();
  const theme = useHtmlTheme();
  const t = shellOf(theme, p.widget);
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!p.disabled });
  const labelStyle = ls.style(["label", "labelText"]);
  // A "legend" captions a group the widget draws itself, so it is a plain
  // element the group names by id: a fieldset here would be a second group.
  const legend = p.labelAs === "legend";
  const after = p.labelPosition === "after";
  const Label = legend ? "div" : "label";
  const hasLabel = p.label !== undefined && p.label !== null;
  const required = p.required && (
    <span className={t.required.className} aria-hidden="true">
      {t.required.text}
    </span>
  );
  // One element for the label's container and its words: the look's two
  // label parts both land on it.
  const labelClass = lookClass(t.label, look?.label, look?.labelText);
  const labelText = (
    <span className={labelClass} style={labelStyle}>
      {p.label}
      {required}
    </span>
  );
  // `labelEnd` help: a button beside the label — never inside it, which
  // would put its name into the field's — that shows the help. The help
  // element stays rendered either way, so it describes the control while
  // only visually hidden.
  const labelEnd = labelEndHelp(p);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButton = labelEnd && (
    <button
      type="button"
      className={t.helpButton.className}
      aria-label={helpButtonName(t.helpButton.text, p.label, p.helpLabel)}
      aria-expanded={helpOpen}
      aria-controls={fieldHelpId(p.id)}
      onClick={() => setHelpOpen((o) => !o)}
    >
      {icon(t.helpButton.icon)}
      {p.helpLabel != null && <span className={t.helpButton.labelClassName}>{p.helpLabel}</span>}
    </button>
  );
  const withHelp = (label: ReactNode) =>
    labelEnd ? (
      <div className={t.labelRow}>
        {label}
        {helpButton}
      </div>
    ) : (
      label
    );
  return (
    <div
      className={lookClass(p.orientation === "horizontal" ? t.horizontal : t.vertical, look?.shell)}
      style={ls.style("shell", portableCss(p.style, theme.tokens.colors))}
      {...ls.pointer}
      data-look={lookAttr(p.look)}
      data-widget={p.widget}
      data-invalid={p.error ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
    >
      {hasLabel && p.hideLabel ? (
        // Named, not drawn: the label element kept, visually hidden, with no
        // theme class and no marker. Never wrapping the control, even for a
        // trailing label, since the control is drawn.
        <>
          <Label
            id={fieldLabelId(p.id)}
            style={visuallyHiddenStyle}
            {...(legend ? {} : { htmlFor: p.id })}
          >
            {p.label}
          </Label>
          {helpButton}
          <div className={t.control}>{p.children}</div>
        </>
      ) : hasLabel && after ? (
        // The label wraps the control, which is how html does a trailing one.
        withHelp(
          <label className={t.labelAfter} id={fieldLabelId(p.id)}>
            {p.children}
            {labelText}
          </label>,
        )
      ) : (
        <>
          {hasLabel
            ? withHelp(
                <Label
                  className={labelClass}
                  style={labelStyle}
                  id={fieldLabelId(p.id)}
                  {...(legend ? {} : { htmlFor: p.id })}
                >
                  {p.label}
                  {required}
                </Label>,
              )
            : helpButton}
          <div className={t.control}>{p.children}</div>
        </>
      )}
      <RequiredNote
        id={p.id}
        required={p.required}
        describeRequired={p.describeRequired}
        text={t.required.note}
      />
      {labelEnd ? (
        <p
          className={t.help}
          id={fieldHelpId(p.id)}
          style={helpOpen ? undefined : visuallyHiddenStyle}
        >
          {p.helpText}
        </p>
      ) : (
        p.helpText &&
        !p.error && (
          <p className={t.help} id={fieldHelpId(p.id)}>
            {p.helpText}
          </p>
        )
      )}
      {p.error &&
        (t.renderError ? (
          t.renderError(p.error, fieldErrorId(p.id))
        ) : (
          <p className={t.error} id={fieldErrorId(p.id)}>
            {p.error}
          </p>
        ))}
      {p.count != null && (
        <p className={p.countOver ? t.countOver : t.count} id={fieldCountId(p.id)}>
          {p.count}
        </p>
      )}
    </div>
  );
}

// ── Frame: the box the border lives on ───────────────────────────────

function HtmlInputFrame(p: InputFrameProps) {
  const icon = useWebIcon();
  const theme = useHtmlTheme();
  const t = theme.frame;
  // The look's control lands where the author's `className` does.
  const look = lookParts("field", p.look, theme.looks);
  const [focused, setFocused] = useState(false);
  const state: FrameState = {
    focused,
    filled: !!p.filled,
    invalid: !!p.invalid,
    disabled: !!p.disabled,
    readOnly: !!p.readOnly,
    multiline: !!p.multiline,
  };
  const slot = (s: IconSpec | ((s: FrameState) => IconSpec)) =>
    icon(typeof s === "function" ? s(state) : s);
  // The author's `style`: its box properties go where the look's control does, its text
  // properties to the control element, which is what draws the words.
  const css = portableCssSplit(p.style, theme.tokens.colors);
  const onInput = t.classNameOn === "input";
  const ls = useLookStyles(look, {
    focused,
    invalid: !!p.invalid,
    disabled: !!p.disabled,
  });
  return (
    <div
      className={
        t.classNameOn === "frame"
          ? lookClass(t.className, look?.control)
          : t.className || undefined
      }
      style={onInput ? undefined : ls.style("control", css.box)}
      {...ls.pointer}
      data-focused={focused ? "" : undefined}
      data-invalid={p.invalid ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
      data-readonly={p.readOnly ? "" : undefined}
      data-multiline={p.multiline ? "" : undefined}
    >
      {p.start !== undefined && (
        <span className={lookClass(t.slot, look?.icon)} style={ls.style("icon")}>
          {slot(p.start)}
        </span>
      )}
      {p.render(
        {
          id: p.id,
          className: (() => {
            const own = p.multiline ? join(t.input, t.multiline) : t.input;
            return t.classNameOn === "input"
              ? lookClass(own, look?.control)
              : own;
          })(),
          style: onInput ? ls.style("control", { ...css.box, ...css.text }) : css.text,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          disabled: p.disabled,
          readOnly: p.readOnly,
          "aria-invalid": p.invalid || undefined,
          "aria-required": p.required || undefined,
          "aria-describedby": p.describedBy,
          ref: p.controlRef,
        },
        state,
      )}
      {p.end !== undefined && (
        <span className={lookClass(t.slot, look?.icon)} style={ls.style("icon")}>
          {slot(p.end)}
        </span>
      )}
    </div>
  );
}

// ── The built-in, written on the two primitives above ────────────────

function HtmlTextField(p: TextFieldRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useTextInput(p.field);
  const theme = useHtmlTheme();
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  // Renderer-specific props arrive unresolved; resolve them here, in this
  // window — and before the frame's render prop, which runs in the frame's.
  const placeholder = getProp(ctl.rc, p.placeholder);
  const inputType = getProp(ctl.rc, p.inputType) ?? "text";
  const multiline = !!getProp(ctl.rc, p.multiline);
  const inputMode = getProp(ctl.rc, p.inputMode);
  const autoComplete = getProp(ctl.rc, p.autoComplete);
  const maxLength = getProp(ctl.rc, p.maxLength);
  const count = countText(ctl.value, getProp(ctl.rc, p.showCount), maxLength);
  const countOver = maxLength !== undefined && ctl.value.length > maxLength;
  return ctl.rendered(
    <Shell
      widget="textfield"
      count={count}
      countOver={countOver}
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      surface="frame"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <Frame
        id={p.id}
        describedBy={describedBy({ ...p, count })}
        controlRef={ctl.elementRef}
        invalid={!!p.error}
        required={p.required}
        disabled={ctl.state.disabled}
        readOnly={ctl.state.readOnly}
        multiline={multiline}
        filled={ctl.filled}
        start={p.startIcon}
        end={p.endIcon}
        look={p.look}
        style={p.style}
        render={(slot, s) => {
          // This callback runs inside the *frame's* render pass, not ours —
          // never make a reactive read here: resolve first, close over values.
          const common = {
            ...slot,
            // The look's `text` part: the words the user types.
            // The control's words: the look's `text` and the author's `textClassName`.
            className: lookClass(slot.className, look?.text),
            style: { ...slot.style, ...ls.style("text") },
            value: ctl.value,
            placeholder,
            inputMode,
            autoComplete,
            maxLength,
            onChange: (e: { target: { value: string } }) =>
              ctl.setValue(e.target.value),
            onBlur: (e: FocusEvent<HTMLElement>) => {
              slot.onBlur?.(e);
              ctl.onBlur();
            },
          };
          return s.multiline ? (
            <textarea {...common} rows={3} />
          ) : (
            <input {...common} type={inputType} />
          );
        }}
      />
    </Shell>,
  );
}

/** Trailing label, rendered by the shell — the widget only draws the box. */
function HtmlDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const icon = useWebIcon();
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const theme = useHtmlTheme();
  const t = theme.displayOnly;
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  const css = ls.style(["control", "text"], portableCss(p.style, theme.tokens.colors));
  const edge = (e: IconSpec) =>
    e != null && (
      <span className={lookClass(t.icon, look?.icon)} style={ls.style("icon")}>
        {icon(e)}
      </span>
    );
  const start = edge(p.startIcon);
  const end = edge(p.endIcon);
  // Inline: the value in prose — no shell, no label, a span.
  if (p.inline)
    return ctl.rendered(
      <span
        id={p.id}
        className={lookClass(t.inline, look?.control, look?.text)}
        style={css}
        data-look={lookAttr(p.look)}
      >
        {start}
        {ctl.content}
        {end}
      </span>,
    );
  return ctl.rendered(
    <Shell
      widget="displayOnly"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      surface="custom"
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <div
        id={p.id}
        className={lookClass(t.className, look?.control, look?.text)}
        style={p.noSelection ? { ...css, userSelect: "none" } : css}
        aria-describedby={describedBy(p)}
      >
        {start}
        {ctl.content}
        {end}
      </div>
    </Shell>,
  );
}

function HtmlCheckbox(p: CheckboxRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  const theme = useHtmlTheme();
  const t = theme.checkbox;
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  return ctl.rendered(
    <Shell
      widget="checkbox"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      labelPosition={p.labelPosition === "before" ? "before" : "after"}
      orientation={p.labelPosition === "before" ? "horizontal" : undefined}
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <input
        ref={ctl.elementRef}
        id={p.id}
        type="checkbox"
        className={lookClass(t.input, look?.control)}
        style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
        {...ls.pointer}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

/**
 * One controller serves both options widgets — a radio group is a select with
 * the list drawn open. Per-option content renders under each entry, selected
 * or not; the content gates itself.
 */
function HtmlRadio(p: RadioRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const theme = useHtmlTheme();
  const t = theme.radio;
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const entries = ctl.options.map((o) => ({
    o,
    selected: ctl.stringValue === String(o.value),
  }));
  const keys = optionKeys(ctl.options);
  // The look's `entry` is on every option's wrapper; `selected` / `notSelected` on the chosen one and the rest.
  const entryClass = (selected: boolean) =>
    lookClass(t.entryWrapper, look?.entry, selected ? look?.selected : look?.notSelected);
  return ctl.rendered(
    <Shell
      widget="radio"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      labelAs="legend"
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <div
        role="radiogroup"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        className={lookClass(t.className, look?.control)}
        style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        onBlur={onFocusLeave(ctl.onBlur)}
      >
        {entries.map(({ o, selected }, i) => (
          <div
            key={keys[i]}
            className={entryClass(selected)}
            style={ls.style(["entry", selected ? "selected" : "notSelected"])}
            data-selected={selected ? "" : undefined}
          >
            <label className={t.entry || undefined}>
              <input
                ref={i === 0 ? ctl.elementRef : undefined}
                id={`${p.id}_${i}`}
                type="radio"
                className={t.input || undefined}
                name={p.id}
                value={String(o.value)}
                checked={selected}
                disabled={locked || o.disabled}
                onChange={() => ctl.setFromString(String(o.value))}
              />
              <span className={lookClass(t.label, look?.text)} style={ls.style("text")}>
                {o.name}
              </span>
            </label>
            {p.children?.(o, selected)}
          </div>
        ))}
      </div>
    </Shell>,
  );
}

/**
 * A labelled group of native checkboxes: the shell's caption names the group
 * and its description describes it, so the one `role="group"` carries both.
 */
function HtmlCheckList(p: CheckListRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const theme = useHtmlTheme();
  const t = theme.checkList;
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const keys = optionKeys(ctl.options);
  return ctl.rendered(
    <Shell
      widget="checkList"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      labelAs="legend"
      surface="custom"
      required={p.required}
      describeRequired
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <div
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={requiredDescribedBy(p)}
        className={lookClass(t.className, look?.control)}
        style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
        onBlur={onFocusLeave(ctl.onBlur)}
      >
        {ctl.options.map((o, i) => (
          <label key={keys[i]} className={t.entry || undefined}>
            <input
              ref={i === 0 ? ctl.elementRef : undefined}
              id={`${p.id}_${i}`}
              type="checkbox"
              aria-invalid={p.error ? true : undefined}
              className={t.input || undefined}
              value={String(o.value)}
              checked={ctl.isSelected(o)}
              disabled={locked || o.disabled}
              onChange={(e) => ctl.setSelected(o, e.target.checked)}
            />
            <span className={lookClass(t.label, look?.text)} style={ls.style("text")}>
              {o.name}
            </span>
          </label>
        ))}
      </div>
    </Shell>,
  );
}

function HtmlTabs(p: TabsRenderProps) {
  const theme = useHtmlTheme();
  const t = theme.tabs;
  const look = lookParts("tabs", p.look, theme.looks);
  const ls = useLookStyles(look);
  const id = useId();
  const tabId = (key: string) => `${id}-tab-${key}`;
  const panelId = (key: string) => `${id}-panel-${key}`;
  return (
    <div
      className={lookClass(t.className, look?.control)}
      style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
      data-look={lookAttr(p.look)}
      data-hidden={p.hidden ? "" : undefined}
      hidden={p.hidden || undefined}
    >
      <div className={t.list} role="tablist">
        {p.items.filter((i) => !i.hidden).map((i) => (
          <button
            key={i.key}
            type="button"
            role="tab"
            id={tabId(i.key)}
            aria-controls={panelId(i.key)}
            aria-selected={i.active}
            className={join(t.tab, i.active ? t.active : t.inactive)}
            data-invalid={i.invalid ? "" : undefined}
            onClick={() => p.setActive(i.key)}
          >
            {i.title}
            {i.invalid && (
              <span className={t.invalidMarker} title="has errors">
                {"\u25CF"}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Every panel, always — an unmounted one validates nothing. */}
      {p.items.map((i) => (
        <div
          key={i.key}
          id={panelId(i.key)}
          role="tabpanel"
          aria-labelledby={i.hidden ? undefined : tabId(i.key)}
          className={t.panel}
          data-inactive={i.active ? undefined : ""}
          hidden={!i.active || undefined}
        >
          {i.content}
        </div>
      ))}
    </div>
  );
}

function HtmlAction(p: ActionRenderProps) {
  const icon = useWebIcon();
  const { displayShell, action: t, looks, tokens } = useHtmlTheme();
  // A role the theme does not name draws as the default emphasis.
  const look = lookParts("action", p.look, looks) ?? lookParts("action", "secondary", looks);
  const ls = useLookStyles(look, { disabled: !!p.disabled });
  const shown = p.busy ? t.busy : icon(p.icon);
  // The icon in a wrapper the theme reaches, whatever element it is.
  const busy = !noContent(shown) && (
    <span className={lookClass(t.iconClassName, look?.icon)} style={ls.style("icon")}>
      {shown}
    </span>
  );
  return (
    <DisplayShell
      shellClassName={look?.shell}
      style={ls.style("shell", portableCss(p.shellStyle, tokens.colors))}
      inline={true}
      kind="action"
      classes={displayShell}
    >
      <button
        // The default button is a submit, so Enter presses it; the click
        // runs the form's submission and the native one never happens.
        type={p.submit ? "submit" : "button"}
        className={lookClass(t.className, look?.control)}
        style={ls.style("control", portableCss(p.style, tokens.colors))}
        {...ls.pointer}
        data-look={lookAttr(p.look)}
        disabled={p.disabled}
        aria-busy={p.busy || undefined}
        onClick={(e) => {
          if (p.submit) e.preventDefault();
          p.onClick();
        }}
      >
        {p.iconPlacement !== "after" && busy}
        {p.iconPlacement !== "replace" &&
          (p.children ?? (
            <span
              className={lookClass(t.textClassName, look?.text)}
              style={ls.style("text")}
            >
              {p.text}
            </span>
          ))}
        {p.iconPlacement === "after" && busy}
      </button>
    </DisplayShell>
  );
}

function HtmlText(p: TextDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  const { displayShell, text: t, looks, tokens } = useHtmlTheme();
  // A heading by role, as a group's title is: the level is the outline's,
  // and an h-element's user-agent margins would restyle every theme. Never
  // in prose.
  const heading = !p.inline && !!getProp(rc, p.heading);
  const level = Math.min(Math.max(p.headingLevel, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
  const Tag = p.inline ? "span" : heading ? "div" : "p";
  const content = getProp(rc, p.text) ?? p.children;
  const look = lookParts("text", p.look, looks);
  const ls = useLookStyles(look);
  // Three slots, three elements: wrapper, element, text.
  return rendered(
    <DisplayShell
      shellClassName={look?.shell}
      style={ls.style("shell", portableCss(p.shellStyle, tokens.colors))}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      classes={displayShell}
    >
      <Tag
        className={lookClass(
            p.inline
              ? t.inline
              : heading
                ? join(t.heading.className, t.heading.levels[level])
                : t.className,
            look?.control,
          )}
        style={ls.style("control", portableCss(p.style, tokens.colors))}
        {...ls.pointer}
        data-look={lookAttr(p.look)}
        {...(heading ? { role: "heading", "aria-level": level } : {})}
      >
        <span className={lookClass(undefined, look?.text)} style={ls.style("text")}>
          {content}
        </span>
      </Tag>
    </DisplayShell>,
  );
}

/**
 * `role="img"` + `aria-label` is what gives a glyph a name; `title` is the
 * html implementation's answer to "is it also visible" — a native tooltip,
 * no library, no provider.
 */
function HtmlIcon(p: IconDisplayRenderProps) {
  const icon = useWebIcon();
  const { rc, rendered } = useReactive();
  const { displayShell, icon: t, looks, tokens } = useHtmlTheme();
  const look = lookParts("icon", p.look, looks);
  const ls = useLookStyles(look);
  return rendered(
    <DisplayShell
      shellClassName={look?.shell}
      style={ls.style("shell", portableCss(p.shellStyle, tokens.colors))}
      inline={true}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly}
      classes={displayShell}
    >
      <span
        className={lookClass(t.className, look?.control, look?.text, look?.icon)}
        style={ls.style(["control", "text", "icon"], portableCss(p.style, tokens.colors))}
        data-look={lookAttr(p.look)}
        role="img"
        aria-label={p.accessibleName}
        title={p.accessibleName}
      >
        {icon(getProp(rc, p.icon), false)}
      </span>
    </DisplayShell>,
  );
}

function HtmlHtml(p: HtmlDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  const { displayShell, html: t, looks, tokens } = useHtmlTheme();
  const html = getProp(rc, p.html);
  const look = lookParts("html", p.look, looks);
  const ls = useLookStyles(look);
  // The html *is* the text, so both slots land on the one element.
  return rendered(
    <DisplayShell
      shellClassName={look?.shell}
      style={ls.style("shell", portableCss(p.shellStyle, tokens.colors))}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      classes={displayShell}
    >
      <div
        className={lookClass(t.className, look?.control, look?.text)}
        style={ls.style(["control", "text"], portableCss(p.style, tokens.colors))}
        data-look={lookAttr(p.look)}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
    </DisplayShell>,
  );
}

function HtmlSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const theme = useHtmlTheme();
  const t = theme.select;
  const look = lookParts("field", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.error, disabled: !!ctl.state.disabled });
  return ctl.rendered(
    <Shell
      widget="select"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      surface="frame"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <Frame
        id={p.id}
        describedBy={describedBy(p)}
        controlRef={ctl.elementRef}
        invalid={!!p.error}
        required={p.required}
        disabled={ctl.state.disabled}
        readOnly={ctl.state.readOnly}
        filled={ctl.stringValue !== ""}
        start={p.startIcon}
        end={p.endIcon}
        look={p.look}
        style={p.style}
        render={(slot) => (
          <select
            {...slot}
            className={lookClass(slot.className, look?.text)}
            style={{ ...slot.style, ...ls.style("text") }}
            value={ctl.stringValue}
            onChange={(e) => ctl.setFromString(e.target.value)}
            onBlur={(e) => {
              slot.onBlur?.(e);
              ctl.onBlur();
            }}
          >
            {/* A required select with a value has no way back to empty. */}
            {(!p.required || ctl.stringValue === "") && (
              <option value="">{getProp(ctl.rc, p.placeholder) ?? t.emptyText}</option>
            )}
            {ctl.options.map((o, i) => (
              <option
                key={keys[i]}
                value={String(o.value)}
                disabled={o.disabled}
              >
                {o.name}
              </option>
            ))}
          </select>
        )}
      />
    </Shell>,
  );
}

function HtmlWizard(p: WizardRenderProps) {
  const theme = useHtmlTheme();
  const t = theme.wizard;
  const look = lookParts("wizard", p.look, theme.looks);
  const ls = useLookStyles(look);
  // `none`: the pages only — the host's own actions move the wizard.
  const nav = p.navigation === "builtin";
  return (
    <div
      className={lookClass(undefined, look?.control)}
      data-look={lookAttr(p.look)}
      style={{ ...ls.style("control", portableCss(p.style, theme.tokens.colors)), ...(p.hidden ? { display: "none" } : {}) }}
    >
      {nav && (
        <ol className={t.steps}>
          {/* Steps over the shown pages only, numbered among themselves. */}
          {p.items
            .map((i, n) => ({ i, n }))
            .filter(({ i }) => !i.hidden)
            .map(({ i, n }, step) => (
              <li
                key={i.key}
                className={t.step}
                data-active={n === p.index ? "" : undefined}
                data-invalid={i.invalid ? "" : undefined}
              >
                <button type="button" onClick={() => p.goTo(n)}>
                  {step + 1}{i.title != null && <>. {i.title}</>}
                </button>
              </li>
            ))}
        </ol>
      )}
      {/* Every page rendered: an unreached one is `silent`, not absent. */}
      {p.items.map((i) => (
        <div
          key={i.key}
          className={t.page}
          data-inactive={i.active ? undefined : ""}
          hidden={!i.active || undefined}
        >
          {i.content}
        </div>
      ))}
      {nav && (
        <div className={t.nav} style={{ marginTop: 12 }}>
          <Action
            actionId={StandardActionIds.back}
            text="Back"
            look="secondary"
            disabled={!p.canBack}
            onClick={p.back}
          />
          <Action
            actionId={StandardActionIds.next}
            text="Next"
            look="primary"
            disabled={!p.canNext}
            onClick={p.next}
          />
        </div>
      )}
    </div>
  );
}

/**
 * A native `<details>`: the browser's own disclosure — the summary is the
 * toggle, announced expanded or collapsed, and find-in-page opens it. Open
 * is the boundary's: the summary's click is taken over so the element never
 * disagrees with the state, and a toggle the browser makes itself (that
 * find-in-page) is reported back. Closed, the UA hides the content, mounted,
 * which is what `silent` needs.
 */
function HtmlDisclosure(p: DisclosureRenderProps) {
  const icon = useWebIcon();
  const theme = useHtmlTheme();
  const t = theme.disclosure;
  const look = lookParts("disclosure", p.look, theme.looks);
  const ls = useLookStyles(look, { invalid: !!p.invalid });
  const toggleIcon = t.icon != null && (
    <span className={t.iconClassName || undefined} data-open={p.open ? "" : undefined} aria-hidden="true">
      {icon(t.icon, false)}
    </span>
  );
  return (
    <details
      className={lookClass(t.className, look?.shell)}
      data-look={lookAttr(p.look)}
      open={p.open}
      onToggle={(e) => {
        if (e.currentTarget.open !== p.open) p.setOpen(e.currentTarget.open);
      }}
      data-invalid={p.invalid ? "" : undefined}
      data-open={p.open ? "" : undefined}
      style={{ ...ls.style("shell", portableCss(p.style, theme.tokens.colors)), ...(p.hidden ? { display: "none" } : {}) }}
    >
      <summary
        className={lookClass(t.summary, look?.control)}
        style={ls.style("control")}
        onClick={(e) => {
          e.preventDefault();
          p.setOpen(!p.open);
        }}
      >
        {t.iconPlacement !== "after" && toggleIcon}
        {p.title}
        {t.iconPlacement === "after" && toggleIcon}
        {p.invalid && (
          <span className={t.invalidMarker} aria-hidden="true">
            {"\u25CF"}
          </span>
        )}
      </summary>
      <div id={p.id} className={t.content}>
        {p.content}
      </div>
    </details>
  );
}

/**
 * A native `<dialog>`. `showModal()`/`close()` are driven from an effect and
 * the content is always its child, so opening never moves it — and while
 * closed the UA hides it, mounted, which is what `silent` needs.
 */
function HtmlDialog(p: DialogRenderProps) {
  const theme = useHtmlTheme();
  const t = theme.dialog;
  const look = lookParts("dialog", p.look, theme.looks);
  const ls = useLookStyles(look);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || p.inline) return;
    if (p.open && !el.open) el.showModal();
    else if (!p.open && el.open) el.close();
  }, [p.open, p.inline]);
  if (p.inline) {
    return (
      <div
        className={lookClass(t.inline, look?.control)}
        style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
        data-look={lookAttr(p.look)}
      >
        {p.title && <strong>{p.title}</strong>}
        {p.content}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      className={lookClass(t.className, look?.control)}
      style={ls.style("control", portableCss(p.style, theme.tokens.colors))}
      data-look={lookAttr(p.look)}
      // Not `onClose`: the native `close` event also fires when the effect
      // above closes the dialog because `open` went false, which would tell
      // the author the user dismissed a dialog their own code closed. Escape
      // is `cancel`; the Close button is an action.
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
      // The dialog is inside the form's <form> (it never moves, so it is
      // never portalled out): Enter in a field here must not press the
      // form's default button behind the modal.
      onKeyDown={(e) => {
        const el = e.target as HTMLElement;
        if (e.key === "Enter" && el.tagName === "INPUT") e.preventDefault();
      }}
    >
      {p.title && <strong className={t.title}>{p.title}</strong>}
      {p.content}
      <div className={t.actions} style={{ marginTop: 12 }}>
        <Action
          actionId={StandardActionIds.close}
          text="Close"
          look="secondary"
          onClick={p.onClose}
        />
      </div>
    </dialog>
  );
}

/** Two own classes on one element; empty slots drop out. */
function join(...cs: (string | undefined)[]): string | undefined {
  return cs.filter(Boolean).join(" ") || undefined;
}

// The shared pieces take their classes as a parameter; the html set passes
// the theme's, and the other three implementations keep the defaults.
function HtmlImage(p: ImageDisplayRenderProps) {
  const t = useHtmlTheme();
  return <ImageDom {...p} classes={t.image} displayShell={t.displayShell} looks={t.looks} />;
}
function HtmlRichText(p: RichTextRenderProps) {
  return <RichTextDom {...p} classes={useHtmlTheme().richText} />;
}
function HtmlContents(p: GroupRenderProps) {
  const t = useHtmlTheme();
  return <ContentsRegion {...p} classes={t.contents} looks={t.looks} />;
}
function HtmlInline(p: GroupRenderProps) {
  const t = useHtmlTheme();
  return <Inline {...p} classes={t.inline} looks={t.looks} />;
}
function HtmlFeed(p: FeedRenderProps<unknown>) {
  return <FeedList {...p} />;
}

function HtmlElements(p: CollectionRenderProps<unknown>) {
  const t = useHtmlTheme();
  return <ElementsList {...p} classes={t.elements} looks={t.looks} />;
}

/**
 * The `visibility` slot as the theme says: {@link FadeVisibility}, or at once
 * with `visibility.transitions: false`. A theme is fixed for a region, so the
 * component here does not change under a mounted widget.
 */
function HtmlVisibility(p: VisibilityProps) {
  return useHtmlTheme().visibility.transitions ? (
    <FadeVisibility {...p} />
  ) : (
    <DefaultVisibility {...p} />
  );
}

/**
 * The HTML implementation: every registry slot, drawn as plain DOM and styled
 * through {@link HtmlTheme}. Pass it to `FormProvider`, or spread it and
 * replace a slot.
 *
 * Behaviour never depends on a class: with {@link defaultHtmlTheme} and no
 * CSS at all, hidden regions, inactive tabs and wizard pages, and closed
 * dialogs are all off screen.
 *
 * @group Rendering
 */
export const htmlRenderers: FormRenderers = {
  name: "html",
  textfield: HtmlTextField,
  checkbox: HtmlCheckbox,
  displayOnly: HtmlDisplayOnly,
  select: HtmlSelect,
  radio: HtmlRadio,
  text: HtmlText,
  html: HtmlHtml,
  icon: HtmlIcon,
  richText: HtmlRichText,
  image: HtmlImage,
  action: HtmlAction,
  contents: HtmlContents,
  inline: HtmlInline,
  wizard: HtmlWizard,
  dialog: HtmlDialog,
  disclosure: HtmlDisclosure,
  tabs: HtmlTabs,
  elements: HtmlElements,
  feed: HtmlFeed,
  visibility: HtmlVisibility,
  form: FormElement,
  checkList: HtmlCheckList,
  fieldShell: HtmlFieldShell,
  inputFrame: HtmlInputFrame,
};
