import { useState, type FocusEvent, type ReactNode } from "react";
import {
  Button,
  Checkbox,
  Flex,
  Group,
  Input,
  MantineProvider,
  Modal,
  Select,
  Stepper,
  Tabs as MTabs,
  Text,
  Tooltip as MTooltip,
} from "@mantine/core";
import "@mantine/core/styles.css";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  describedBy,
  getProp,
  mergeClass,
  useFieldShell,
  useInputFrame,
  Action,
  StandardActionIds,
  useCheckbox,
  useSelectController,
  useTextInput,
  type ControlSlotProps,
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
import {
  Contents,
  ElementsList,
  DefaultVisibility,
  glyphFor,
} from "./shared.js";

// ── Shell: wired by `id` only, no context ────────────────────────────

function MantineFieldShell(p: FieldShellProps) {
  return (
    <Input.Wrapper
      id={p.id}
      label={p.labelPosition === "after" ? undefined : p.label}
      description={p.error ? undefined : p.helpText}
      error={p.error}
      required={p.required}
      labelElement={p.labelAs === "legend" ? "div" : "label"}
      className={mergeClass(undefined, p.className)}
      labelProps={{
        className: mergeClass(
          undefined,
          combineClass(p.labelClassName, p.labelTextClassName),
        ),
      }}
      mb="sm"
    >
      {p.labelPosition === "after" ? (
        <Group gap={8} align="center">
          {p.children}
          <Input.Label htmlFor={p.id} required={p.required}>
            {p.label}
          </Input.Label>
        </Group>
      ) : (
        p.children
      )}
    </Input.Wrapper>
  );
}

/** Stable identity, same reason as MUI's — see README finding 10. */
function MantineSlotBridge({
  __render,
  __state,
  ...rest
}: Record<string, any>) {
  return __render(rest as ControlSlotProps, __state as FrameState);
}

function MantineInputFrame(p: InputFrameProps) {
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
  const render = (cp: ControlSlotProps, s: FrameState) =>
    p.render(
      {
        ...cp,
        onFocus: (e) => {
          cp.onFocus?.(e);
          setFocused(true);
        },
        onBlur: (e) => {
          cp.onBlur?.(e);
          setFocused(false);
        },
      },
      s,
    );
  return (
    <Input
      component={MantineSlotBridge}
      id={p.id}
      error={p.invalid}
      disabled={p.disabled}
      multiline={p.multiline}
      leftSection={p.start !== undefined ? slot(p.start) : undefined}
      rightSection={p.end !== undefined ? slot(p.end) : undefined}
      aria-describedby={p.describedBy}
      className={mergeClass(undefined, p.className)}
      {...({ __render: render, __state: state } as object)}
    />
  );
}

function MantineTextField(p: TextFieldRenderProps): Rendered {
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

/** Mantine takes the trailing label as a prop on the control. */
function MantineCheckbox(p: CheckboxRenderProps): Rendered {
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
        onChange={(e) => ctl.setChecked(e.currentTarget.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

function MantineStack(p: StackProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <Flex
      direction={getProp(rc, p.direction) ?? "column"}
      gap={getProp(rc, p.gap) ?? 16}
      justify={getProp(rc, p.justify)}
      align={getProp(rc, p.align)}
      wrap={getProp(rc, p.wrap) ? "wrap" : "nowrap"}
      className={mergeClass(undefined, getProp(rc, p.className))}
    >
      {p.children}
    </Flex>,
  );
}

function MantineTabs(p: TabsRenderProps) {
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <MTabs
        value={p.activeKey}
        onChange={(v) => v && p.setActive(v)}
        keepMounted
        // Not the default, and it has to be said: Mantine hides inactive
        // panels with React's <Activity>, which keeps the DOM but *destroys
        // effects* — and `silent` lives in effects (validator registration,
        // validation-scope registration, clearHidden). With the default an
        // inactive tab silently stops reporting its errors.
        keepMountedMode="display-none"
      >
        <MTabs.List mb="md">
          {p.items.map((i) => (
            <MTabs.Tab
              key={i.key}
              value={i.key}
              color={i.invalid ? "red" : undefined}
            >
              {i.title}
            </MTabs.Tab>
          ))}
        </MTabs.List>
        {p.items.map((i) => (
          // `keepMounted` is Mantine's escape hatch, and `silent` requires it.
          <MTabs.Panel key={i.key} value={i.key} keepMounted>
            {i.content}
          </MTabs.Panel>
        ))}
      </MTabs>
    </div>
  );
}

function MantineAction(p: ActionRenderProps) {
  return (
    <Button
      variant={
        p.style === "primary"
          ? "filled"
          : p.style === "link"
            ? "subtle"
            : "default"
      }
      size="xs"
      className={mergeClass(undefined, p.className)}
      disabled={p.disabled}
      loading={p.busy}
      leftSection={
        (p.iconPlacement ?? "before") === "before" ? p.icon : undefined
      }
      rightSection={p.iconPlacement === "after" ? p.icon : undefined}
      onClick={p.onClick}
      aria-label={p.iconPlacement === "replace" ? String(p.text) : undefined}
    >
      {p.iconPlacement === "replace"
        ? p.icon
        : (p.children ?? (
            <span className={mergeClass(undefined, p.textClassName)}>
              {p.text}
            </span>
          ))}
    </Button>
  );
}

function MantineText(p: TextDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <Text
      size="sm"
      className={mergeClass(undefined, p.className ?? p.textClassName)}
    >
      {getProp(rc, p.text) ?? p.children}
    </Text>,
  );
}

function MantineIcon(p: IconDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  const glyph = (
    <Text
      component="span"
      role="img"
      aria-label={p.accessibleName}
      className={mergeClass(undefined, p.className)}
      style={{ fontSize: 24, lineHeight: 1 }}
    >
      {glyphFor(getProp(rc, p.icon))}
    </Text>
  );
  return rendered(
    p.accessibleName ? (
      <MTooltip label={p.accessibleName}>{glyph}</MTooltip>
    ) : (
      glyph
    ),
  );
}

function MantineHtml(p: HtmlDisplayRenderProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <Text
      size="sm"
      component="div"
      className={mergeClass(undefined, p.className)}
      dangerouslySetInnerHTML={{ __html: getProp(rc, p.html) ?? "" }}
    />,
  );
}

function MantineSelect(p: SelectRenderProps): Rendered {
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
      labelTextClassName={p.labelTextClassName}
    >
      <Select
        id={p.id}
        value={ctl.stringValue === "" ? null : ctl.stringValue}
        error={!!p.error}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        clearable
        onChange={(v) => ctl.setFromString(v ?? "")}
        onBlur={ctl.onBlur}
        data={ctl.options.map((o) => ({
          value: String(o.value),
          label: o.name,
          disabled: o.disabled,
        }))}
      />
    </Shell>,
  );
}

function MantineWizard(p: WizardRenderProps) {
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <Stepper active={p.index} onStepClick={p.goTo} mb="md" size="sm">
        {p.items.map((i) => (
          <Stepper.Step
            key={i.key}
            label={i.title}
            color={i.invalid && i.visited ? "red" : undefined}
          />
        ))}
      </Stepper>
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
        <Action
          actionId={StandardActionIds.back}
          text="Back"
          style="secondary"
          disabled={!p.canBack}
          onClick={p.back}
        />
        <Action
          actionId={StandardActionIds.next}
          text="Next"
          style="primary"
          disabled={!p.canNext}
          onClick={p.next}
        />
      </div>
    </div>
  );
}

/**
 * `keepMounted` with `keepMountedMode="display-none"` — the default mode is
 * `activity`, which destroys effects and with them the closed dialog's
 * validators. The same switch, and the same trap, as Mantine's Tabs.
 */
function MantineDialog(p: DialogRenderProps) {
  if (p.inline)
    return (
      <div
        style={{ border: "1px solid #dee2e6", borderRadius: 8, padding: 16 }}
      >
        {p.title && <Text fw={600}>{p.title}</Text>}
        {p.content}
      </div>
    );
  return (
    <Modal
      opened={p.open}
      onClose={p.onClose}
      title={p.title}
      keepMounted
      keepMountedMode="display-none"
    >
      {p.content}
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={p.onClose}>
          Close
        </Button>
      </Group>
    </Modal>
  );
}

export const mantineRenderers: FormRenderers = {
  name: "Mantine",
  textfield: MantineTextField,
  checkbox: MantineCheckbox,
  select: MantineSelect,
  text: MantineText,
  html: MantineHtml,
  icon: MantineIcon,
  action: MantineAction,
  contents: Contents,
  wizard: MantineWizard,
  dialog: MantineDialog,
  tabs: MantineTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  fieldShell: MantineFieldShell,
  inputFrame: MantineInputFrame,
  stack: MantineStack,
  root: ({ children }) => <MantineProvider>{children}</MantineProvider>,
};
