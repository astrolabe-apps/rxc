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
  useInputFrame,
  StandardActionIds,
  useAction,
  useCheckbox,
  useSelectController,
  useTextInput,
  type ActionRenderProps,
  type HtmlDisplayRenderProps,
  type IconDisplayRenderProps,
  type TextDisplayRenderProps,
  type CheckboxRenderProps,
  type SelectRenderProps,
  type FieldShellProps,
  type FormRenderers,
  type FrameState,
  type InputFrameProps,
  type StackProps,
  type TabsRenderProps,
  type WizardRenderProps,
  type DialogRenderProps,
  type TextFieldRenderProps,
  combineClass,
} from "../framework/index.js";
import { Contents, ElementsList, FadeVisibility, glyphFor } from "./shared.js";

// ── Shell: family 1 (children-hosting, class-driven — Bootstrap / shadcn) ──

function HtmlFieldShell(p: FieldShellProps) {
  const legend = p.labelAs === "legend";
  const after = p.labelPosition === "after";
  const Outer = legend ? "fieldset" : "div";
  const Label = legend ? "legend" : "label";
  const hasLabel = p.label !== undefined && p.label !== null;
  const labelText = (
    <span
      className={mergeClass(
        "ff-label",
        combineClass(p.labelClassName, p.labelTextClassName),
      )}
    >
      {p.label}
      {p.required && <span className="ff-required">*</span>}
    </span>
  );
  return (
    <Outer
      className={mergeClass(
        `ff-shell ff-shell--${p.orientation ?? "vertical"}`,
        p.className,
      )}
      data-invalid={p.error ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
    >
      {hasLabel && after ? (
        // The label wraps the control, which is how html does a trailing one.
        <label className="ff-label-after">
          {p.children}
          {labelText}
        </label>
      ) : (
        <>
          {hasLabel && (
            <Label
              className={mergeClass(
                "ff-label",
                combineClass(p.labelClassName, p.labelTextClassName),
              )}
              {...(legend ? {} : { htmlFor: p.id })}
            >
              {p.label}
              {p.required && <span className="ff-required">*</span>}
            </Label>
          )}
          <div className="ff-control">{p.children}</div>
        </>
      )}
      {p.helpText && !p.error && (
        <p className="ff-help" id={`${p.id}-help`}>
          {p.helpText}
        </p>
      )}
      {p.error && (
        <p className="ff-error" id={`${p.id}-error`}>
          {p.error}
        </p>
      )}
    </Outer>
  );
}

// ── Frame: the box the border lives on ───────────────────────────────

function HtmlInputFrame(p: InputFrameProps) {
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
      className={mergeClass("ff-frame", p.className)}
      data-focused={focused ? "" : undefined}
      data-invalid={p.invalid ? "" : undefined}
      data-disabled={p.disabled ? "" : undefined}
      data-readonly={p.readOnly ? "" : undefined}
      data-multiline={p.multiline ? "" : undefined}
    >
      {p.start !== undefined && (
        <span className="ff-slot">{slot(p.start)}</span>
      )}
      {p.render(
        {
          id: p.id,
          className: "ff-input",
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          disabled: p.disabled,
          readOnly: p.readOnly,
          "aria-invalid": p.invalid || undefined,
          "aria-describedby": p.describedBy,
        },
        state,
      )}
      {p.end !== undefined && <span className="ff-slot">{slot(p.end)}</span>}
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
          // never make a reactive read here. See README finding 8.
          const common = {
            ...slot,
            value: ctl.value,
            placeholder,
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
function HtmlCheckbox(p: CheckboxRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
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
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        aria-describedby={describedBy(p)}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

function HtmlStack(p: StackProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <div
      className={mergeClass("ff-stack", getProp(rc, p.className))}
      style={{
        display: "flex",
        flexDirection: getProp(rc, p.direction) ?? "column",
        gap: getProp(rc, p.gap) ?? 16,
        justifyContent: getProp(rc, p.justify),
        alignItems: getProp(rc, p.align),
        flexWrap: getProp(rc, p.wrap) ? "wrap" : undefined,
      }}
    >
      {p.children}
    </div>,
  );
}

function HtmlTabs(p: TabsRenderProps) {
  return (
    <div
      className={mergeClass("ff-tabs", p.className)}
      data-hidden={p.hidden ? "" : undefined}
    >
      <div className="ff-tabstrip" role="tablist">
        {p.items.map((i) => (
          <button
            key={i.key}
            type="button"
            role="tab"
            aria-selected={i.active}
            className={mergeClass(
              "ff-tab",
              i.active ? "ff-tab--active" : undefined,
            )}
            data-invalid={i.invalid ? "" : undefined}
            onClick={() => p.setActive(i.key)}
          >
            {i.title}
            {i.invalid && (
              <span className="ff-tab-dot" title="has errors">
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
          className="ff-tabpanel"
          data-inactive={i.active ? undefined : ""}
        >
          {i.content}
        </div>
      ))}
    </div>
  );
}

function HtmlAction(p: ActionRenderProps) {
  return (
    <button
      type="button"
      className={mergeClass(`ff-btn ff-btn--${p.style}`, p.className)}
      disabled={p.disabled}
      aria-busy={p.busy || undefined}
      onClick={p.onClick}
    >
      {p.iconPlacement !== "after" &&
        (p.busy ? <span className="ff-spinner" /> : p.icon)}
      {p.iconPlacement !== "replace" &&
        (p.children ?? (
          <span className={mergeClass(undefined, p.textClassName)}>
            {p.text}
          </span>
        ))}
      {p.iconPlacement === "after" &&
        (p.busy ? <span className="ff-spinner" /> : p.icon)}
    </button>
  );
}

function HtmlText(p: TextDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <p className={mergeClass("ff-text", p.className ?? p.textClassName)}>
      {getProp(rc, p.text) ?? p.children}
    </p>,
  );
}

/**
 * `role="img"` + `aria-label` is what gives a glyph a name; `title` is the
 * html implementation's answer to "is it also visible" — a native tooltip,
 * no library, no provider.
 */
function HtmlIcon(p: IconDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <span
      className={mergeClass("ff-icon", p.className)}
      role="img"
      aria-label={p.accessibleName}
      title={p.accessibleName}
    >
      {glyphFor(getProp(rc, p.icon))}
    </span>,
  );
}

function HtmlHtml(p: HtmlDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <div
      className={mergeClass("ff-html", p.className)}
      dangerouslySetInnerHTML={{ __html: getProp(rc, p.html) ?? "" }}
    />,
  );
}

function HtmlSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useSelectController(p.field, p.options);
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
            <option value="" />
            {ctl.options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
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
  const NextBtn = useAction(StandardActionIds.next);
  const BackBtn = useAction(StandardActionIds.back);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <ol className="ff-steps">
        {p.items.map((i, n) => (
          <li
            key={i.key}
            className="ff-step"
            data-active={n === p.index ? "" : undefined}
            data-invalid={i.invalid && i.visited ? "" : undefined}
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
          className="ff-wizard-page"
          data-inactive={i.active ? undefined : ""}
        >
          {i.content}
        </div>
      ))}
      <div className="ff-row" style={{ marginTop: 12 }}>
        <BackBtn
          actionId={StandardActionIds.back}
          text="Back"
          style="secondary"
          disabled={!p.canBack}
          busy={false}
          onClick={p.back}
        />
        <NextBtn
          actionId={StandardActionIds.next}
          text="Next"
          style="primary"
          disabled={!p.canNext}
          busy={false}
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || p.inline) return;
    if (p.open && !el.open) el.showModal();
    else if (!p.open && el.open) el.close();
  }, [p.open, p.inline]);
  if (p.inline) {
    return (
      <div className={mergeClass("ff-modal-inline", p.className)}>
        {p.title && <strong>{p.title}</strong>}
        {p.content}
      </div>
    );
  }
  return (
    <dialog
      ref={ref}
      className={mergeClass("ff-modal", p.className)}
      onClose={p.onClose}
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
    >
      {p.title && <strong className="ff-modal-title">{p.title}</strong>}
      {p.content}
      <div className="ff-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="ff-btn ff-btn--secondary"
          onClick={p.onClose}
        >
          Close
        </button>
      </div>
    </dialog>
  );
}

export const htmlRenderers: FormRenderers = {
  name: "html",
  textfield: HtmlTextField,
  checkbox: HtmlCheckbox,
  select: HtmlSelect,
  text: HtmlText,
  html: HtmlHtml,
  icon: HtmlIcon,
  action: HtmlAction,
  contents: Contents,
  wizard: HtmlWizard,
  dialog: HtmlDialog,
  tabs: HtmlTabs,
  elements: ElementsList,
  visibility: FadeVisibility,
  fieldShell: HtmlFieldShell,
  inputFrame: HtmlInputFrame,
  stack: HtmlStack,
};
