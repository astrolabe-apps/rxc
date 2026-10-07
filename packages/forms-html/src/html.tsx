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
  mergeClass,
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
  type TextFieldRenderProps,
  type GroupRenderProps,
  type CollectionRenderProps,
  combineClass,
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
  visuallyHiddenStyle,
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
  const t = shellOf(useHtmlTheme(), p.widget);
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
  const labelClass = mergeClass(
    t.label,
    combineClass(p.labelClassName, p.labelTextClassName),
  );
  const labelText = (
    <span className={labelClass}>
      {p.label}
      {required}
    </span>
  );
  return (
    <div
      className={mergeClass(
        p.orientation === "horizontal" ? t.horizontal : t.vertical,
        p.className,
      )}
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
          <div className={t.control}>{p.children}</div>
        </>
      ) : hasLabel && after ? (
        // The label wraps the control, which is how html does a trailing one.
        <label className={t.labelAfter} id={fieldLabelId(p.id)}>
          {p.children}
          {labelText}
        </label>
      ) : (
        <>
          {hasLabel && (
            <Label
              className={labelClass}
              id={fieldLabelId(p.id)}
              {...(legend ? {} : { htmlFor: p.id })}
            >
              {p.label}
              {required}
            </Label>
          )}
          <div className={t.control}>{p.children}</div>
        </>
      )}
      <RequiredNote
        id={p.id}
        required={p.required}
        describeRequired={p.describeRequired}
        text={t.required.note}
      />
      {p.helpText && !p.error && (
        <p className={t.help} id={fieldHelpId(p.id)}>
          {p.helpText}
        </p>
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
  const t = useHtmlTheme().frame;
  const [focused, setFocused] = useState(false);
  const state: FrameState = {
    focused,
    filled: !!p.filled,
    invalid: !!p.invalid,
    disabled: !!p.disabled,
    readOnly: !!p.readOnly,
    multiline: !!p.multiline,
  };
  const slot = (s: ReactNode | ((s: FrameState) => ReactNode)) =>
    typeof s === "function" ? s(state) : s;
  return (
    <div
      className={
        t.classNameOn === "frame"
          ? mergeClass(t.className, p.className)
          : t.className || undefined
      }
      data-focused={focused ? "" : undefined}
      data-invalid={p.invalid ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
      data-readonly={p.readOnly ? "" : undefined}
      data-multiline={p.multiline ? "" : undefined}
    >
      {p.start !== undefined && <span className={t.slot}>{slot(p.start)}</span>}
      {p.render(
        {
          id: p.id,
          className: (() => {
            const own = p.multiline ? join(t.input, t.multiline) : t.input;
            return t.classNameOn === "input"
              ? mergeClass(own, p.className)
              : own;
          })(),
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
      {p.end !== undefined && <span className={t.slot}>{slot(p.end)}</span>}
    </div>
  );
}

// ── The built-in, written on the two primitives above ────────────────

function HtmlTextField(p: TextFieldRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useTextInput(p.field);
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
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
        className={p.className}
        render={(slot, s) => {
          // This callback runs inside the *frame's* render pass, not ours —
          // never make a reactive read here: resolve first, close over values.
          const common = {
            ...slot,
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
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const t = useHtmlTheme().displayOnly;
  const start = p.startIcon != null && <span className={t.icon}>{p.startIcon}</span>;
  const end = p.endIcon != null && <span className={t.icon}>{p.endIcon}</span>;
  // Inline: the value in prose — no shell, no label, a span.
  if (p.inline)
    return ctl.rendered(
      <span
        id={p.id}
        className={mergeClass(t.inline, p.className ?? p.textClassName)}
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div
        id={p.id}
        className={mergeClass(t.className, p.className ?? p.textClassName)}
        style={p.noSelection ? { userSelect: "none" } : undefined}
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
  const t = useHtmlTheme().checkbox;
  return ctl.rendered(
    <Shell
      widget="checkbox"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      labelPosition="after"
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <input
        ref={ctl.elementRef}
        id={p.id}
        type="checkbox"
        className={t.input || undefined}
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
  const t = useHtmlTheme().radio;
  const entryCls = getProp(ctl.rc, p.entryClassName);
  const onCls = getProp(ctl.rc, p.selectedClassName);
  const offCls = getProp(ctl.rc, p.notSelectedClassName);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const entries = ctl.options.map((o) => ({
    o,
    selected: ctl.stringValue === String(o.value),
  }));
  const keys = optionKeys(ctl.options);
  const entryClass = (selected: boolean) =>
    mergeClass(mergeClass(t.entryWrapper, entryCls), selected ? onCls : offCls);
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div
        role="radiogroup"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        className={mergeClass(t.className, p.className)}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        onBlur={onFocusLeave(ctl.onBlur)}
      >
        {entries.map(({ o, selected }, i) => (
          <div
            key={keys[i]}
            className={entryClass(selected)}
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
              <span className={mergeClass(t.label, p.textClassName)}>
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
  const t = useHtmlTheme().checkList;
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={requiredDescribedBy(p)}
        className={mergeClass(t.className, p.className)}
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
            <span className={mergeClass(t.label, p.textClassName)}>{o.name}</span>
          </label>
        ))}
      </div>
    </Shell>,
  );
}

function HtmlTabs(p: TabsRenderProps) {
  const t = useHtmlTheme().tabs;
  const id = useId();
  const tabId = (key: string) => `${id}-tab-${key}`;
  const panelId = (key: string) => `${id}-panel-${key}`;
  return (
    <div
      className={mergeClass(t.className, p.className)}
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
            className={mergeClass(t.tab, i.active ? t.active : t.inactive)}
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
  const { displayShell, action: t } = useHtmlTheme();
  const variant = t.variants[p.variant];
  const busy = p.busy ? t.busy : p.icon;
  return (
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={true}
      kind="action"
      classes={displayShell}
    >
      <button
        // The default button is a submit, so Enter presses it; the click
        // runs the form's submission and the native one never happens.
        type={p.submit ? "submit" : "button"}
        className={mergeClass(join(t.className, variant.className), p.className)}
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
              className={mergeClass(
                join(t.textClassName, variant.textClassName),
                p.textClassName,
              )}
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
  const { displayShell, text: t } = useHtmlTheme();
  const Tag = p.inline ? "span" : "p";
  const content = getProp(rc, p.text) ?? p.children;
  // Three slots, three elements: wrapper, element, text.
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      classes={displayShell}
    >
      <Tag
        className={mergeClass(p.inline ? t.inline : t.className, p.className)}
      >
        <span className={mergeClass(undefined, p.textClassName)}>
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
  const { rc, rendered } = useReactive();
  const { displayShell, icon: t } = useHtmlTheme();
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={true}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly}
      classes={displayShell}
    >
      <span
        className={mergeClass(
          t.className,
          combineClass(p.className, p.textClassName),
        )}
        role="img"
        aria-label={p.accessibleName}
        title={p.accessibleName}
      >
        {getProp(rc, p.icon)}
      </span>
    </DisplayShell>,
  );
}

function HtmlHtml(p: HtmlDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  const { displayShell, html: t } = useHtmlTheme();
  const html = getProp(rc, p.html);
  // The html *is* the text, so both slots land on the one element.
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      classes={displayShell}
    >
      <div
        className={mergeClass(
          t.className,
          combineClass(p.className, p.textClassName),
        )}
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
  const t = useHtmlTheme().select;
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
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
        className={p.className}
        render={(slot) => (
          <select
            {...slot}
            value={ctl.stringValue}
            onChange={(e) => ctl.setFromString(e.target.value)}
            onBlur={(e) => {
              slot.onBlur?.(e);
              ctl.onBlur();
            }}
          >
            {/* A required select with a value has no way back to empty. */}
            {(!p.required || ctl.stringValue === "") && (
              <option value="">{t.emptyText}</option>
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
  const t = useHtmlTheme().wizard;
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
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
                {step + 1}. {i.title}
              </button>
            </li>
          ))}
      </ol>
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
      <div className={t.nav} style={{ marginTop: 12 }}>
        <Action
          actionId={StandardActionIds.back}
          text="Back"
          variant="secondary"
          disabled={!p.canBack}
          onClick={p.back}
        />
        <Action
          actionId={StandardActionIds.next}
          text="Next"
          variant="primary"
          disabled={!p.canNext}
          onClick={p.next}
        />
      </div>
    </div>
  );
}

/**
 * A native `<dialog>`. `showModal()`/`close()` are driven from an effect and
 * the content is always its child, so opening never moves it — and while
 * closed the UA hides it, mounted, which is what `silent` needs.
 */
function HtmlDialog(p: DialogRenderProps) {
  const t = useHtmlTheme().dialog;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || p.inline) return;
    if (p.open && !el.open) el.showModal();
    else if (!p.open && el.open) el.close();
  }, [p.open, p.inline]);
  if (p.inline) {
    return (
      <div className={mergeClass(t.inline, p.className)}>
        {p.title && <strong>{p.title}</strong>}
        {p.content}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      className={mergeClass(t.className, p.className)}
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
          variant="secondary"
          onClick={p.onClose}
        />
      </div>
    </dialog>
  );
}

/** Two own classes on one element; empty slots drop out. */
function join(...cs: string[]): string | undefined {
  return cs.filter(Boolean).join(" ") || undefined;
}

// The shared pieces take their classes as a parameter; the html set passes
// the theme's, and the other three implementations keep the defaults.
function HtmlContents(p: GroupRenderProps) {
  return <ContentsRegion {...p} classes={useHtmlTheme().contents} />;
}
function HtmlInline(p: GroupRenderProps) {
  return <Inline {...p} classes={useHtmlTheme().inline} />;
}
function HtmlElements(p: CollectionRenderProps<unknown>) {
  return <ElementsList {...p} classes={useHtmlTheme().elements} />;
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
  action: HtmlAction,
  contents: HtmlContents,
  inline: HtmlInline,
  wizard: HtmlWizard,
  dialog: HtmlDialog,
  tabs: HtmlTabs,
  elements: HtmlElements,
  visibility: HtmlVisibility,
  form: FormElement,
  checkList: HtmlCheckList,
  fieldShell: HtmlFieldShell,
  inputFrame: HtmlInputFrame,
};
