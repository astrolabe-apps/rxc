import { useState, type FocusEvent, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  ConfigProvider,
  Flex,
  Form,
  Modal,
  Radio,
  Select,
  Steps,
  Tabs as AntTabList,
  Tooltip as AntTooltip,
  Typography,
  theme,
} from "antd";
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
  combineClass,
} from "@rx-controls/forms-react";
import {
  Contents,
  Inline,
  ElementsList,
  DefaultVisibility,
  DisplayShell,
  optionKeys,
} from "@rx-controls/forms-html/shared";

// ── Shell: Ant's `Form.Item`, used standalone ────────────────────────
//
// It works with no surrounding `<Form>` as long as the item has no `name`:
// with a name it would clone `value`/`onChange` into its single child, which
// is precisely the binding the framework has already made.

function AntFieldShell(p: FieldShellProps) {
  const { token } = theme.useToken();
  return (
    <Form.Item
      layout={p.orientation === "horizontal" ? "horizontal" : "vertical"}
      label={p.labelPosition === "after" ? undefined : p.label}
      htmlFor={p.labelAs === "legend" ? undefined : p.id}
      required={p.required}
      validateStatus={p.error ? "error" : undefined}
      help={p.error ?? p.helpText}
      className={mergeClass(undefined, p.className)}
      style={{ marginBottom: 12 }}
    >
      {p.labelPosition === "after" ? (
        // Ant's own checkbox takes its label as a child, which a shell cannot
        // reach into — so the trailing label is a sibling <label> instead,
        // the same bill the frame pays.
        <Flex align="center" gap={8}>
          {p.children}
          <label
            htmlFor={p.id}
            style={{
              cursor: p.disabled ? "not-allowed" : "pointer",
              // Ant greys its own label from a class on the wrapper, which a
              // sibling label never gets — so the shell maps it by hand.
              color: p.disabled ? token.colorTextDisabled : undefined,
            }}
          >
            {p.label}
            {p.required && <span style={{ color: token.colorError }}> *</span>}
          </label>
        </Flex>
      ) : (
        p.children
      )}
    </Form.Item>
  );
}

// ── Frame: restated from theme tokens ────────────────────────────────
//
// Ant's `Input` renders its own `<input>` and accepts no arbitrary child, so
// an Ant frame that hosts the contract's render prop cannot *be* `<Input>` —
// it has to restate the affix wrapper from theme tokens, and its chrome goes
// on the control through `style`: there is no class to put a runtime token in.

function AntInputFrame(p: InputFrameProps) {
  const { token } = theme.useToken();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
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
  const borderColor = p.invalid
    ? p.disabled
      ? token.colorBorder
      : token.colorError
    : focused
      ? token.colorPrimary
      : hovered && !p.disabled
        ? token.colorPrimaryHover
        : token.colorBorder;
  return (
    <span
      className={mergeClass(undefined, p.className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: p.multiline ? "flex-start" : "center",
        gap: token.paddingXXS,
        width: "100%",
        // Ant's reset.css makes everything border-box; it is the app's to
        // load, so a full-width frame must not count on it.
        boxSizing: "border-box",
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadius,
        border: `1px solid ${borderColor}`,
        boxShadow: focused
          ? `0 0 0 2px ${p.invalid ? token.colorErrorBorder : token.controlOutline}`
          : undefined,
        background: p.disabled
          ? token.colorBgContainerDisabled
          : token.colorBgContainer,
        color: p.disabled ? token.colorTextDisabled : token.colorText,
        transition: "all .2s",
      }}
    >
      {p.start !== undefined && (
        <span style={{ color: token.colorTextPlaceholder }}>
          {slot(p.start)}
        </span>
      )}
      {p.render(
        {
          id: p.id,
          style: {
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "inherit",
            font: "inherit",
            padding: 0,
            resize: "vertical",
          },
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          disabled: p.disabled,
          readOnly: p.readOnly,
          "aria-invalid": p.invalid || undefined,
          "aria-describedby": p.describedBy,
        },
        state,
      )}
      {p.end !== undefined && (
        <span style={{ color: token.colorTextPlaceholder }}>{slot(p.end)}</span>
      )}
    </span>
  );
}

function AntTextField(p: TextFieldRenderProps): Rendered {
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

function AntDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  // Ant's Text is already a span; inline only drops the shell.
  if (p.inline)
    return ctl.rendered(
      <Typography.Text
        id={p.id}
        className={mergeClass(undefined, p.className ?? p.textClassName)}
      >
        {ctl.content}
      </Typography.Text>,
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
    >
      <Typography.Text
        id={p.id}
        className={mergeClass(undefined, p.className ?? p.textClassName)}
        style={p.noSelection ? { userSelect: "none" } : undefined}
      >
        {ctl.content}
      </Typography.Text>
    </Shell>,
  );
}

/** Ant puts the label *inside* the control — it is the checkbox's child. */
function AntCheckbox(p: CheckboxRenderProps): Rendered {
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
    >
      <Checkbox
        id={p.id}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

function AntTabs(p: TabsRenderProps) {
  const { token } = theme.useToken();
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <AntTabList
        activeKey={p.activeKey}
        onChange={p.setActive}
        className={mergeClass(undefined, p.className)}
        items={p.items.map((i) => ({
          key: i.key,
          label: (
            <span style={i.invalid ? { color: token.colorError } : undefined}>
              {i.title}
            </span>
          ),
          children: i.content,
          // Ant mounts a panel on first visit; `silent` needs all of them
          // from the start, so the escape hatch is mandatory here.
          forceRender: true,
        }))}
      />
    </div>
  );
}

function AntAction(p: ActionRenderProps) {
  return (
    <DisplayShell shellClassName={p.shellClassName} inline={true} kind="action">
      <Button
        type={
          p.variant === "primary"
            ? "primary"
            : p.variant === "link"
              ? "link"
              : "default"
        }
        size="small"
        className={mergeClass(undefined, p.className)}
        disabled={p.disabled}
        loading={p.busy}
        icon={p.icon}
        iconPlacement={p.iconPlacement === "after" ? "end" : "start"}
        onClick={p.onClick}
        aria-label={p.iconPlacement === "replace" ? String(p.text) : undefined}
      >
        {p.iconPlacement === "replace"
          ? null
          : (p.children ?? (
              <span className={mergeClass(undefined, p.textClassName)}>
                {p.text}
              </span>
            ))}
      </Button>
    </DisplayShell>
  );
}

function AntText(p: TextDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <DisplayShell shellClassName={p.shellClassName} inline={p.inline}>
      <Typography.Text className={mergeClass(undefined, p.className)}>
        <span className={mergeClass(undefined, p.textClassName)}>
          {getProp(rc, p.text) ?? p.children}
        </span>
      </Typography.Text>
    </DisplayShell>,
  );
}

function AntIcon(p: IconDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  const glyph = (
    <span
      role="img"
      aria-label={p.accessibleName}
      className={mergeClass(
        undefined,
        combineClass(p.className, p.textClassName),
      )}
      style={{ fontSize: 24, lineHeight: 1 }}
    >
      {getProp(rc, p.icon)}
    </span>
  );
  return rendered(
    <DisplayShell shellClassName={p.shellClassName} inline={true}>
      {p.accessibleName ? (
        <AntTooltip title={p.accessibleName}>{glyph}</AntTooltip>
      ) : (
        glyph
      )}
    </DisplayShell>,
  );
}

function AntHtml(p: HtmlDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <DisplayShell shellClassName={p.shellClassName} inline={p.inline}>
      <Typography
        className={mergeClass(
          undefined,
          combineClass(p.className, p.textClassName),
        )}
        dangerouslySetInnerHTML={{ __html: getProp(rc, p.html) ?? "" }}
      />
    </DisplayShell>,
  );
}

function AntSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <Select
        id={p.id}
        value={ctl.stringValue === "" ? undefined : ctl.stringValue}
        status={p.error ? "error" : undefined}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        allowClear
        onChange={(v) => ctl.setFromString(v ?? "")}
        onBlur={ctl.onBlur}
        options={ctl.options.map((o, i) => ({
          key: keys[i],
          value: String(o.value),
          label: o.name,
          disabled: o.disabled,
        }))}
      />
    </Shell>,
  );
}

function AntRadio(p: RadioRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const entryCls = getProp(ctl.rc, p.entryClassName);
  const onCls = getProp(ctl.rc, p.selectedClassName);
  const offCls = getProp(ctl.rc, p.notSelectedClassName);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const entries = ctl.options.map((o) => ({
    o,
    selected: ctl.stringValue === String(o.value),
  }));
  const entryClass = (selected: boolean) =>
    mergeClass(
      mergeClass("rxf-radio-entry", entryCls),
      selected ? onCls : offCls,
    );
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
      <Radio.Group
        name={p.id}
        value={ctl.stringValue === "" ? undefined : ctl.stringValue}
        onChange={(e) => ctl.setFromString(String(e.target.value))}
        onBlur={ctl.onBlur}
        className={mergeClass(undefined, p.className)}
      >
        <Flex vertical gap={8}>
          {entries.map(({ o, selected }, i) => (
            <div key={keys[i]} className={entryClass(selected)}>
              <Radio value={String(o.value)} disabled={locked || o.disabled}>
                {o.name}
              </Radio>
              {p.children?.(o, selected)}
            </div>
          ))}
        </Flex>
      </Radio.Group>
    </Shell>,
  );
}

function AntWizard(p: WizardRenderProps) {
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <Steps
        current={p.index}
        style={{ marginBottom: 16 }}
        onChange={p.goTo}
        items={p.items.map((i) => ({
          title: i.title,
          status: i.invalid ? "error" : undefined,
        }))}
      />
      {/* Every page rendered: an unreached one is `silent`, not absent. */}
      {p.items.map((i) => (
        <div
          key={i.key}
          className="rxf-wizard-page"
          data-inactive={i.active ? undefined : ""}
          // Off screen with no css at all: hiding never hangs on a class.
          hidden={!i.active || undefined}
        >
          {i.content}
        </div>
      ))}
      <Flex gap={8} style={{ marginTop: 12 }}>
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
      </Flex>
    </div>
  );
}

/** `forceRender` mounts the body before first open; `destroyOnHidden={false}` keeps it. */
function AntDialog(p: DialogRenderProps) {
  if (p.inline)
    return (
      <div
        style={{ border: "1px solid #d9d9d9", borderRadius: 8, padding: 16 }}
      >
        {p.title && <Typography.Title level={5}>{p.title}</Typography.Title>}
        {p.content}
      </div>
    );
  return (
    <Modal
      open={p.open}
      onCancel={p.onClose}
      onOk={p.onClose}
      title={p.title}
      forceRender
      destroyOnHidden={false}
      footer={
        <Action
          actionId={StandardActionIds.close}
          text="Close"
          variant="secondary"
          onClick={p.onClose}
        />
      }
    >
      {p.content}
    </Modal>
  );
}

/**
 * The Ant Design implementation: every registry slot drawn with `antd`. Pass
 * it to `FormProvider`; its `root` mounts Ant's `ConfigProvider`. Ant's
 * `reset.css` is the app's to load, if it wants it — a library cannot import
 * css.
 *
 * Ant is the implementation whose chrome is runtime theme tokens, computed per
 * render, so the input frame styles the control slot through `style`; whose
 * checkbox takes its label as a child, so the trailing label is a sibling; and
 * whose tabs and modal must each be told twice to keep `silent` content
 * mounted (`forceRender`, and `destroyOnHidden={false}` on the modal).
 *
 * @group Rendering
 */
export const antdRenderers: FormRenderers = {
  name: "Ant",
  textfield: AntTextField,
  checkbox: AntCheckbox,
  displayOnly: AntDisplayOnly,
  select: AntSelect,
  radio: AntRadio,
  text: AntText,
  html: AntHtml,
  icon: AntIcon,
  action: AntAction,
  contents: Contents,
  inline: Inline,
  wizard: AntWizard,
  dialog: AntDialog,
  tabs: AntTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  fieldShell: AntFieldShell,
  inputFrame: AntInputFrame,
  root: ({ children }) => <ConfigProvider>{children}</ConfigProvider>,
};
