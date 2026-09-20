import { useState, type FocusEvent, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  ConfigProvider,
  Flex,
  Form,
  Input,
  Select,
  Steps,
  Tabs as AntTabList,
  Tooltip as AntTooltip,
  Typography,
  theme,
} from "antd";
import "antd/dist/reset.css";
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
  type TextFieldRenderProps,
} from "../framework/index.js";
import {
  Contents,
  ElementsList,
  DefaultVisibility,
  glyphFor,
} from "./shared.js";

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
        // reach into — so the trailing label is a sibling <label> instead.
        // Same bill survey point 6 charges Ant for the frame.
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

// ── Frame: the honest cost of §7 finding 6 ───────────────────────────
//
// Ant's `Input` renders its own `<input>` and accepts no arbitrary child, so
// an Ant frame that hosts the contract's render prop cannot *be* `<Input>` —
// it has to restate the affix wrapper from theme tokens. See README finding 12
// for what that loses, and `AntInputReference` below for the visual diff.

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
    >
      <Frame
        id={p.id}
        describedBy={describedBy(p)}
        invalid={!!p.error}
        disabled={ctl.state.disabled}
        readOnly={ctl.state.readOnly}
        multiline={!!p.multiline}
        filled={ctl.filled}
        start={p.startIcon}
        end={p.endIcon}
        className={p.className}
        render={(slot, s) => {
          const common = {
            ...slot,
            value: ctl.value,
            placeholder: p.placeholder,
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
            <input {...common} type={p.inputType ?? "text"} />
          );
        }}
      />
    </Shell>,
  );
}

/** Not part of the contract — the demo renders these next to the real thing. */
export function AntInputReference() {
  return (
    <>
      <Form.Item layout="vertical" label="Ant <Input> itself (reference)">
        <Input prefix="@" suffix=".com" placeholder="not framework-bound" />
      </Form.Item>
      <Form.Item layout="vertical" label="Ant <Checkbox> itself (reference)">
        <Checkbox>Has pets</Checkbox>
      </Form.Item>
    </>
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

function AntStack(p: StackProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <Flex
      vertical={(getProp(rc, p.direction) ?? "column") === "column"}
      gap={getProp(rc, p.gap) ?? 16}
      justify={getProp(rc, p.justify)}
      align={getProp(rc, p.align)}
      wrap={getProp(rc, p.wrap)}
      className={mergeClass(undefined, getProp(rc, p.className))}
    >
      {p.children}
    </Flex>,
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
    <Button
      type={
        p.style === "primary"
          ? "primary"
          : p.style === "link"
            ? "link"
            : "default"
      }
      size="small"
      disabled={p.disabled}
      loading={p.busy}
      icon={p.icon}
      onClick={p.onClick}
    >
      {p.children ?? p.text}
    </Button>
  );
}

function AntText(p: TextDisplayRenderProps) {
  return (
    <Typography.Text
      className={mergeClass(undefined, p.className ?? p.textClassName)}
    >
      {p.text ?? p.children}
    </Typography.Text>
  );
}

function AntIcon(p: IconDisplayRenderProps) {
  const glyph = (
    <span
      role="img"
      aria-label={p.accessibleName}
      className={mergeClass(undefined, p.className)}
      style={{ fontSize: 24, lineHeight: 1 }}
    >
      {glyphFor(p.icon)}
    </span>
  );
  return p.accessibleName ? (
    <AntTooltip title={p.accessibleName}>{glyph}</AntTooltip>
  ) : (
    glyph
  );
}

function AntHtml(p: HtmlDisplayRenderProps) {
  return (
    <Typography
      className={mergeClass(undefined, p.className)}
      dangerouslySetInnerHTML={{ __html: p.html ?? "" }}
    />
  );
}

function AntSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
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
    >
      <Select
        id={p.id}
        value={ctl.stringValue === "" ? undefined : ctl.stringValue}
        status={p.error ? "error" : undefined}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        allowClear
        onChange={(v) => ctl.setFromString(v ?? "")}
        onBlur={ctl.onBlur}
        options={ctl.options.map((o) => ({
          value: String(o.value),
          label: o.name,
          disabled: o.disabled,
        }))}
      />
    </Shell>,
  );
}

function AntWizard(p: WizardRenderProps) {
  const NextBtn = useAction(StandardActionIds.next);
  const BackBtn = useAction(StandardActionIds.back);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <Steps
        current={p.index}
        style={{ marginBottom: 16 }}
        onChange={p.goTo}
        items={p.items.map((i) => ({
          title: i.title,
          status: i.invalid && i.visited ? "error" : undefined,
        }))}
      />
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

export const antdRenderers: FormRenderers = {
  name: "Ant",
  textfield: AntTextField,
  checkbox: AntCheckbox,
  select: AntSelect,
  text: AntText,
  html: AntHtml,
  icon: AntIcon,
  action: AntAction,
  contents: Contents,
  wizard: AntWizard,
  tabs: AntTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  fieldShell: AntFieldShell,
  inputFrame: AntInputFrame,
  stack: AntStack,
  root: ({ children }) => <ConfigProvider>{children}</ConfigProvider>,
};
