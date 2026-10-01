import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  describedBy,
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
  useTextInput,
  type ActionRenderProps,
  type HtmlDisplayRenderProps,
  type IconDisplayRenderProps,
  type TextDisplayRenderProps,
  type CheckboxRenderProps,
  type SelectRenderProps,
  type RadioRenderProps,
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
  Contents,
  Inline,
  ElementsList,
  FadeVisibility,
  DisplayShell,
  optionKeys,
} from "./shared.js";
import { useHtmlTheme } from "./theme.js";

// ── Shell: family 1 (children-hosting, class-driven — Bootstrap / shadcn) ──

function HtmlFieldShell(p: FieldShellProps) {
  const t = useHtmlTheme().shell;
  const legend = p.labelAs === "legend";
  const after = p.labelPosition === "after";
  const Outer = legend ? "fieldset" : "div";
  const Label = legend ? "legend" : "label";
  const hasLabel = p.label !== undefined && p.label !== null;
  const required = p.required && (
    <span className={t.required.className}>{t.required.text}</span>
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
    <Outer
      className={mergeClass(
        p.orientation === "horizontal" ? t.horizontal : t.vertical,
        p.className,
      )}
      data-invalid={p.error ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
    >
      {hasLabel && after ? (
        // The label wraps the control, which is how html does a trailing one.
        <label className={t.labelAfter}>
          {p.children}
          {labelText}
        </label>
      ) : (
        <>
          {hasLabel && (
            <Label
              className={labelClass}
              {...(legend ? {} : { htmlFor: p.id })}
            >
              {p.label}
              {required}
            </Label>
          )}
          <div className={t.control}>{p.children}</div>
        </>
      )}
      {p.helpText && !p.error && (
        <p className={t.help} id={`${p.id}-help`}>
          {p.helpText}
        </p>
      )}
      {p.error &&
        (t.renderError ? (
          t.renderError(p.error, `${p.id}-error`)
        ) : (
          <p className={t.error} id={`${p.id}-error`}>
            {p.error}
          </p>
        ))}
    </Outer>
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
          "aria-describedby": p.describedBy,
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
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
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
        invalid={!!p.error}
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
  // Inline: the value in prose — no shell, no label, a span.
  if (p.inline)
    return ctl.rendered(
      <span
        id={p.id}
        className={mergeClass(t.inline, p.className ?? p.textClassName)}
      >
        {ctl.content}
      </span>,
    );
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
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
        {ctl.content}
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
      id={p.id}
      label={p.label}
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
        id={p.id}
        type="checkbox"
        className={t.input || undefined}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        aria-describedby={describedBy(p)}
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
      id={p.id}
      label={p.label}
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
        className={mergeClass(t.className, p.className)}
        aria-describedby={describedBy(p)}
      >
        {entries.map(({ o, selected }, i) => (
          <div
            key={keys[i]}
            className={entryClass(selected)}
            data-selected={selected ? "" : undefined}
          >
            <label className={t.entry || undefined}>
              <input
                id={`${p.id}_${i}`}
                type="radio"
                className={t.input || undefined}
                name={p.id}
                value={String(o.value)}
                checked={selected}
                disabled={locked || o.disabled}
                onChange={() => ctl.setFromString(String(o.value))}
                onBlur={ctl.onBlur}
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

function HtmlTabs(p: TabsRenderProps) {
  const t = useHtmlTheme().tabs;
  return (
    <div
      className={mergeClass(t.className, p.className)}
      data-hidden={p.hidden ? "" : undefined}
      hidden={p.hidden || undefined}
    >
      <div className={t.list} role="tablist">
        {p.items.map((i) => (
          <button
            key={i.key}
            type="button"
            role="tab"
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
          role="tabpanel"
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
        type="button"
        className={mergeClass(join(t.className, variant.className), p.className)}
        disabled={p.disabled}
        aria-busy={p.busy || undefined}
        onClick={p.onClick}
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
  // Three slots, three elements: wrapper, element, text.
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      classes={displayShell}
    >
      <Tag
        className={mergeClass(p.inline ? t.inline : t.className, p.className)}
      >
        <span className={mergeClass(undefined, p.textClassName)}>
          {getProp(rc, p.text) ?? p.children}
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
  // The html *is* the text, so both slots land on the one element.
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      classes={displayShell}
    >
      <div
        className={mergeClass(
          t.className,
          combineClass(p.className, p.textClassName),
        )}
        dangerouslySetInnerHTML={{ __html: getProp(rc, p.html) ?? "" }}
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
      id={p.id}
      label={p.label}
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
        invalid={!!p.error}
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
            <option value="">{t.emptyText}</option>
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
        {p.items.map((i, n) => (
          <li
            key={i.key}
            className={t.step}
            data-active={n === p.index ? "" : undefined}
            data-invalid={i.invalid ? "" : undefined}
          >
            <button type="button" onClick={() => p.goTo(n)}>
              {n + 1}. {i.title}
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
  return <Contents {...p} classes={useHtmlTheme().contents} />;
}
function HtmlInline(p: GroupRenderProps) {
  return <Inline {...p} classes={useHtmlTheme().inline} />;
}
function HtmlElements(p: CollectionRenderProps<unknown>) {
  return <ElementsList {...p} classes={useHtmlTheme().elements} />;
}

/**
 * The HTML implementation: every registry slot, drawn as plain DOM and styled
 * through {@link HtmlTheme}. Pass it to `FormProvider`, or spread it and
 * replace a slot: `{ ...htmlRenderers, visibility: DefaultVisibility }`.
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
  visibility: FadeVisibility,
  fieldShell: HtmlFieldShell,
  inputFrame: HtmlInputFrame,
};
