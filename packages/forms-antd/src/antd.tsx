import {
  useId,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Checkbox,
  Collapse,
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
  type HtmlDisplayRenderProps,
  type IconDisplayRenderProps,
  type TextDisplayRenderProps,
  type Tone,
  type CheckboxRenderProps,
  type SelectRenderProps,
  type RadioRenderProps,
  type CheckListRenderProps,
  type FieldShellProps,
  type FormRenderers,
  type FrameState,
  type InputFrameProps,
  type TabsRenderProps,
  type GroupRenderProps,
  type WizardRenderProps,
  type DialogRenderProps,
  type DisclosureRenderProps,
  type TextFieldRenderProps,
  combineClass,
} from "@rx-controls/forms-react";
import {
  ContentsRegion,
  Inline,
  ElementsList,
  DefaultVisibility,
  FormElement,
  DisplayShell,
  noContent,
  onFocusLeave,
  optionKeys,
  RequiredNote,
  requiredDescribedBy,
  labelEndHelp,
  visuallyHiddenStyle,
} from "@rx-controls/forms-html/shared";

// ── Shell: Ant's `Form.Item`, used standalone ────────────────────────
//
// It works with no surrounding `<Form>` as long as the item has no `name`:
// with a name it would clone `value`/`onChange` into its single child, which
// is precisely the binding the framework has already made.

function AntFieldShell(p: FieldShellProps) {
  const { token } = theme.useToken();
  const marker = p.required && (
    <span
      aria-hidden="true"
      style={{
        color: token.colorError,
        marginInlineEnd: token.marginXXS,
        fontFamily: "SimSun, sans-serif",
        lineHeight: 1,
      }}
    >
      *
    </span>
  );
  // `labelEnd` help: an info button beside the label, its help in a
  // tooltip. Not Form.Item's own `tooltip`, which puts the icon — and its
  // name — inside the <label>, i.e. into the field's name: the shell draws
  // the label row itself, outside Form.Item's label, in its type.
  const labelEnd = labelEndHelp(p);
  const helpButton = labelEnd && (
    <AntTooltip title={p.helpText} trigger={["hover", "focus"]}>
      <Button
        type="text"
        size="small"
        aria-label="Help"
        icon={<span aria-hidden="true">ⓘ</span>}
        style={{ color: token.colorTextDescription }}
      />
    </AntTooltip>
  );
  const ownLabel = labelEnd && p.labelPosition !== "after" && p.label != null && !p.hideLabel;
  return (
    <Form.Item
      layout={p.orientation === "horizontal" ? "horizontal" : "vertical"}
      // The contract's label id on a span inside Ant's own <label>. The
      // marker is drawn here rather than by `required`: Ant's is a CSS
      // ::before, which browsers read into the accessible name.
      label={
        p.labelPosition === "after" || p.label == null || p.hideLabel || ownLabel ? undefined : (
          <>
            {marker}
            <span id={fieldLabelId(p.id)}>{p.label}</span>
          </>
        )
      }
      htmlFor={p.labelAs === "legend" ? undefined : p.id}
      validateStatus={p.error ? "error" : undefined}
      // Form.Item renders `help` under ids of its own; the contract's ids
      // (what every control's aria-describedby names) go on a span inside.
      help={
        p.error ? (
          <span id={fieldErrorId(p.id)}>{p.error}</span>
        ) : p.helpText && !labelEnd ? (
          <span id={fieldHelpId(p.id)}>{p.helpText}</span>
        ) : undefined
      }
      // The count under the help, as Ant draws a form item's `extra`.
      extra={
        p.count != null ? (
          <span
            id={fieldCountId(p.id)}
            style={p.countOver ? { color: token.colorError } : undefined}
          >
            {p.count}
          </span>
        ) : undefined
      }
      className={mergeClass(undefined, p.className)}
      // Spacing is the container's (the group body's gap), as under html.
      // Explicitly none: Ant's own margin is one an error message takes
      // over, which left a display after a field in error flush against it.
      style={{ marginBottom: 0 }}
    >
      <RequiredNote
        id={p.id}
        required={p.required}
        describeRequired={p.describeRequired}
        text="Required"
      />
      {labelEnd && (
        <span id={fieldHelpId(p.id)} style={visuallyHiddenStyle}>
          {p.helpText}
        </span>
      )}
      {ownLabel && (
        <Flex align="center" gap={token.marginXXS} style={{ paddingBottom: token.paddingXS }}>
          {p.labelAs === "legend" ? (
            <div id={fieldLabelId(p.id)} style={{ color: token.colorTextHeading }}>
              {marker}
              {p.label}
            </div>
          ) : (
            <label htmlFor={p.id} id={fieldLabelId(p.id)} style={{ color: token.colorTextHeading }}>
              {marker}
              {p.label}
            </label>
          )}
          {helpButton}
        </Flex>
      )}
      {p.label != null && p.hideLabel ? (
        // Named, not drawn: a plain label, visually hidden, beside the control.
        <>
          {p.labelAs === "legend" ? (
            <div id={fieldLabelId(p.id)} style={visuallyHiddenStyle}>
              {p.label}
            </div>
          ) : (
            <label
              htmlFor={p.id}
              id={fieldLabelId(p.id)}
              style={visuallyHiddenStyle}
            >
              {p.label}
            </label>
          )}
          {helpButton}
          {p.children}
        </>
      ) : p.labelPosition === "after" ? (
        // Ant's own checkbox takes its label as a child, which a shell cannot
        // reach into — so the trailing label is a sibling <label> instead,
        // the same bill the frame pays.
        <Flex align="center" gap={8}>
          {p.children}
          <label
            htmlFor={p.id}
            id={fieldLabelId(p.id)}
            style={{
              cursor: p.disabled ? "not-allowed" : "pointer",
              // Ant greys its own label from a class on the wrapper, which a
              // sibling label never gets — so the shell maps it by hand.
              color: p.disabled ? token.colorTextDisabled : undefined,
            }}
          >
            {p.label}
            {p.required && (
              <span aria-hidden="true" style={{ color: token.colorError }}>
                {" "}
                *
              </span>
            )}
          </label>
          {helpButton}
        </Flex>
      ) : (
        <>
          {p.label == null && helpButton}
          {p.children}
        </>
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
          "aria-required": p.required || undefined,
          "aria-describedby": p.describedBy,
          ref: p.controlRef,
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

function AntDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const { token } = theme.useToken();
  // The icons either side of the value, spaced as Ant spaces an affix.
  const icon = (node: ReactNode, side: "start" | "end") =>
    node != null && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          [side === "start" ? "marginInlineEnd" : "marginInlineStart"]:
            token.marginXXS,
        }}
      >
        {node}
      </span>
    );
  const start = icon(p.startIcon, "start");
  const end = icon(p.endIcon, "end");
  // Ant's Text is already a span; inline only drops the shell.
  if (p.inline)
    return ctl.rendered(
      <Typography.Text
        id={p.id}
        className={mergeClass(undefined, p.className ?? p.textClassName)}
      >
        {start}
        {ctl.content}
        {end}
      </Typography.Text>,
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
      error={p.error}
      className={p.shellClassName}
    >
      <Typography.Text
        id={p.id}
        className={mergeClass(undefined, p.className ?? p.textClassName)}
        style={p.noSelection ? { userSelect: "none" } : undefined}
      >
        {start}
        {ctl.content}
        {end}
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
      widget="checkbox"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      labelPosition="after"
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      error={p.error}
      className={p.shellClassName}
    >
      <Checkbox
        ref={ctl.elementRef}
        id={p.id}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

/**
 * Ant's own checkboxes in a labelled group. Not `Checkbox.Group`: it keys its
 * value by option value, which would lose a numeric choice's type, and takes
 * no ids for the shell's name and description.
 */
function AntCheckList(p: CheckListRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <div
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={requiredDescribedBy(p)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
      >
        <Flex vertical gap={8}>
          {ctl.options.map((o, i) => (
            <Checkbox
              key={keys[i]}
              ref={i === 0 ? ctl.elementRef : undefined}
              aria-invalid={p.error ? true : undefined}
              checked={ctl.isSelected(o)}
              disabled={locked || o.disabled}
              onChange={(e) => ctl.setSelected(o, e.target.checked)}
            >
              {o.name}
            </Checkbox>
          ))}
        </Flex>
      </div>
    </Shell>,
  );
}

function AntTabs(p: TabsRenderProps) {
  const { token } = theme.useToken();
  const id = useId();
  // Ant's items carry label and panel together, so a hidden tab stays in the
  // list — dropping it would unmount its panel — and its button is collapsed
  // by a style scoped to this strip; the panel is inactive, so Ant hides that.
  // Collapsed in place rather than `display: none`: Ant measures every tab
  // to decide what overflows, and a removed one lands it in the "more" menu.
  const hiddenTabs = p.items
    .filter((i) => i.hidden)
    .map((i) => `[data-rxf-tabs="${id}"] .ant-tabs-tab[data-node-key=${JSON.stringify(i.key)}]`);
  return (
    <div
      data-rxf-tabs={id}
      style={p.hidden ? { display: "none" } : undefined}
    >
      {hiddenTabs.length > 0 && (
        <style>{`${hiddenTabs.join(",")}{width:0;padding:0;margin:0;border:0;overflow:hidden;visibility:hidden}`}</style>
      )}
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
        htmlType={p.submit ? "submit" : "button"}
        onClick={(e) => {
          if (p.submit) e.preventDefault();
          p.onClick();
        }}
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

/** A tone's colour from Ant's theme tokens, inherited by the text inside. */
/**
 * A heading's type at an outline level, from the tokens: a group title's, and
 * a heading display's. Ant sets its font per component, not on the page.
 */
function headingStyle(
  token: ReturnType<typeof theme.useToken>["token"],
  level: number,
): CSSProperties {
  const top = level <= 2;
  return {
    fontFamily: token.fontFamily,
    color: token.colorTextHeading,
    fontWeight: token.fontWeightStrong,
    fontSize: top ? token.fontSizeHeading4 : token.fontSizeHeading5,
    lineHeight: top ? token.lineHeightHeading4 : token.lineHeightHeading5,
  };
}

/**
 * A titled group: the shared region, its title set in Ant's heading type from
 * theme tokens. Not `Typography.Title` itself, which draws an h-element; the
 * heading's level is the outline's, by role. Sized for a form section rather
 * than by that level — level 2 would be Ant's 30px — so the top level takes
 * heading 4's size and anything deeper heading 5's.
 */
function AntContents(p: GroupRenderProps) {
  const { token } = theme.useToken();
  return (
    <ContentsRegion
      {...p}
      // The body's default layout: a column spaced from the tokens, so every
      // child — a display, a nested region — is spaced, not only the fields.
      layoutStyle={{
        display: "flex",
        flexDirection: "column",
        gap: token.marginSM,
      }}
      titleStyle={{
        ...headingStyle(token, p.headingLevel ?? 2),
        marginBottom: token.marginXS,
      }}
    />
  );
}

function useToneStyle(tone: Tone | undefined): CSSProperties | undefined {
  const { token } = theme.useToken();
  if (!tone) return undefined;
  const color = {
    error: token.colorError,
    warning: token.colorWarning,
    info: token.colorInfo,
    success: token.colorSuccess,
  }[tone];
  return { color };
}

function AntText(p: TextDisplayRenderProps) {
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const { token } = theme.useToken();
  const content = getProp(rc, p.text) ?? p.children;
  // A heading by role, in a group title's type at this level.
  const heading = !p.inline && !!getProp(rc, p.heading);
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      style={toneStyle}
    >
      <Typography.Text
        className={mergeClass(undefined, p.className)}
        // Ant's Typography sets its own colour; inherit the shell's tone.
        style={{
          ...(heading ? { display: "block", ...headingStyle(token, p.headingLevel) } : {}),
          ...(p.tone ? { color: "inherit" } : {}),
        }}
        {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
      >
        <span className={mergeClass(undefined, p.textClassName)}>
          {content}
        </span>
      </Typography.Text>
    </DisplayShell>,
  );
}

function AntIcon(p: IconDisplayRenderProps) {
  const toneStyle = useToneStyle(p.tone);
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
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={true}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly}
      style={toneStyle}
    >
      {p.accessibleName ? (
        <AntTooltip title={p.accessibleName}>{glyph}</AntTooltip>
      ) : (
        glyph
      )}
    </DisplayShell>,
  );
}

function AntHtml(p: HtmlDisplayRenderProps) {
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const html = getProp(rc, p.html);
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      style={toneStyle}
    >
      <Typography
        className={mergeClass(
          undefined,
          combineClass(p.className, p.textClassName),
        )}
        style={p.tone ? { color: "inherit" } : undefined}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
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
      widget="select"
      id={p.id}
      label={p.label}
      hideLabel={p.hideLabel}
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <AntSelectWithEnd end={p.endIcon}>
        <Select
          ref={ctl.elementRef}
          id={p.id}
          prefix={p.startIcon ?? undefined}
          aria-describedby={describedBy(p)}
          aria-invalid={p.error ? true : undefined}
          aria-required={p.required || undefined}
          value={ctl.stringValue === "" ? undefined : ctl.stringValue}
          status={p.error ? "error" : undefined}
          disabled={ctl.state.disabled || ctl.state.readOnly}
          // A required select with a value has no way back to empty.
          allowClear={!p.required || ctl.stringValue === ""}
          onChange={(v) => ctl.setFromString(v ?? "")}
          onBlur={ctl.onBlur}
          options={ctl.options.map((o, i) => ({
            key: keys[i],
            value: String(o.value),
            label: o.name,
            disabled: o.disabled,
          }))}
        />
      </AntSelectWithEnd>
    </Shell>,
  );
}

/**
 * Ant's Select has a `prefix` but no trailing slot of its own — `suffixIcon`
 * replaces the arrow — so an `endIcon` sits beside it.
 */
function AntSelectWithEnd({ end, children }: { end?: ReactNode; children: ReactNode }) {
  if (end == null) return <>{children}</>;
  return (
    <Flex align="center" gap={8}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {end}
    </Flex>
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
      labelTextClassName={p.labelTextClassName}
    >
      <Radio.Group
        name={p.id}
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        value={ctl.stringValue === "" ? undefined : ctl.stringValue}
        onChange={(e) => ctl.setFromString(String(e.target.value))}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
      >
        <Flex vertical gap={8}>
          {entries.map(({ o, selected }, i) => (
            <div key={keys[i]} className={entryClass(selected)}>
              <Radio
                ref={i === 0 ? ctl.elementRef : undefined}
                value={String(o.value)}
                disabled={locked || o.disabled}
              >
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
  // `none`: the pages only — the host's own actions move the wizard.
  const nav = p.navigation === "builtin";
  const shown = p.items.map((i, n) => ({ i, n })).filter(({ i }) => !i.hidden);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      {/* Steps over the shown pages; Ant reports a step by its position. */}
      {nav && (
        <Steps
          current={shown.findIndex((s) => s.n === p.index)}
          style={{ marginBottom: 16 }}
          onChange={(step) => p.goTo(shown[step]!.n)}
          items={shown.map(({ i }) => ({
            title: i.title,
            status: i.invalid ? "error" : undefined,
          }))}
        />
      )}
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
      {nav && (
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
      )}
    </div>
  );
}

/**
 * Ant's Collapse, one panel: its header is the toggle (`aria-expanded`), and
 * as with the modal it must be told twice to keep a closed panel's content —
 * `forceRender` mounts it before the first open, `destroyOnHidden={false}`
 * keeps it after a close. `silent` needs both.
 */
function AntDisclosure(p: DisclosureRenderProps) {
  const { token } = theme.useToken();
  return (
    <Collapse
      className={mergeClass(undefined, p.className)}
      style={p.hidden ? { display: "none" } : undefined}
      activeKey={p.open ? ["panel"] : []}
      onChange={(keys) => p.setOpen((Array.isArray(keys) ? keys : [keys]).length > 0)}
      destroyOnHidden={false}
      data-invalid={p.invalid ? "" : undefined}
      items={[
        {
          key: "panel",
          forceRender: true,
          label: (
            <span style={p.invalid ? { color: token.colorError } : undefined}>{p.title}</span>
          ),
          children: <div id={p.id}>{p.content}</div>,
        },
      ]}
    />
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
  checkList: AntCheckList,
  text: AntText,
  html: AntHtml,
  icon: AntIcon,
  action: AntAction,
  contents: AntContents,
  inline: Inline,
  wizard: AntWizard,
  dialog: AntDialog,
  disclosure: AntDisclosure,
  tabs: AntTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  form: FormElement,
  fieldShell: AntFieldShell,
  inputFrame: AntInputFrame,
  root: ({ children }) => <ConfigProvider>{children}</ConfigProvider>,
};
