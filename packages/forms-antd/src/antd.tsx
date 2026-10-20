import {
  createContext,
  useContext,
  useId,
  useMemo,
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
  Spin,
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
  type PortableStyle,
  lookNames,
  NO_LOOK_STATE,
  type LookState,
  type LookRef,
  type RichTextRenderProps,
  helpButtonName,
  type ImageDisplayRenderProps,
  type IconSpec,
  type FeedRenderProps,
  useDateInput,
  dateModeOf,
  toBrowserDateValue,
  fromBrowserDateValue,
} from "@rx-controls/forms-react";
import {
  ContentsRegion,
  RichTextDom,
  ImageDom,
  useLookLayers,
  pickLooks,
  lookAttr,
  type GroupLookStyle,
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
  portableCss,
  useLookWidth,
  webIcon,
  FeedList,
  drawDateInput,
  useHtmlLookFallback,
  type LookPartName,
} from "@rx-controls/forms-html/shared";
import { useHtmlTheme } from "@rx-controls/forms-html";
import { atToken, useAntdLooks, type AntFieldLook, type AntStyle } from "./looks.js";

// ── Shell: Ant's `Form.Item`, used standalone ────────────────────────
//
// It works with no surrounding `<Form>` as long as the item has no `name`:
// with a name it would clone `value`/`onChange` into its single child, which
// is precisely the binding the framework has already made.

/**
 * The look a field was given, for its shell and its frame: they are drawn by
 * components the field does not own (a host may replace either), so it
 * travels privately — set by the field, read by the pair.
 */
type ResolvedFieldLook = { [P in keyof AntFieldLook]?: CSSProperties };
/** The html look's classes on the same elements (see `useHtmlLookFallback`). */
type FieldLookClasses = { [P in keyof AntFieldLook]?: string };
const AntFieldLookContext = createContext<{
  look?: ResolvedFieldLook;
  classes?: FieldLookClasses;
  attr?: string;
}>({});

/** The html look's parts each of a field's elements carries. */
const HTML_FIELD_PARTS: Record<keyof AntFieldLook, LookPartName | LookPartName[]> = {
  shell: "shell",
  label: ["label", "labelText"],
  control: "control",
  text: "text",
};

const isFn = (v: unknown): boolean => typeof v === "function";

/**
 * A look's layers merged, later over earlier: each prop a later layer names
 * replaces the earlier's, and the styles are laid in order — so a list of looks
 * layers as it does under html. `style` comes back as one style (a function
 * of the tokens and the state), and `needsState` says whether any layer's is
 * a function.
 */
function mergeLayers<T extends { style?: AntStyle }>(
  layers: readonly T[],
): { props: Omit<T, "style">; style: AntStyle | undefined; needsState: boolean } {
  let props = {} as Omit<T, "style">;
  for (const { style: _s, ...rest } of layers) props = { ...props, ...rest };
  const styled = layers.filter((l) => l.style !== undefined);
  return {
    props,
    needsState: styled.some((l) => isFn(l.style)),
    style: styled.length
      ? (token, state) => Object.assign({}, ...styled.map((l) => atToken(l.style, token, state)))
      : undefined,
  };
}

/** A field's named look, and the context value that hands it to its shell and frame. */
function useAntFieldLook(look: LookRef | undefined, base?: Partial<LookState>) {
  const { token } = theme.useToken();
  const table = useAntdLooks().field;
  const found = useLookLayers("field", look, table);
  // The window's width only if a part asks for it.
  const width = useLookWidth(found.some((l) => Object.values(l).some(isFn)));
  const invalid = !!base?.invalid;
  const names = lookNames(look).join("|");
  // The names' parts laid in order, a later over an earlier.
  const own = useMemo<ResolvedFieldLook | undefined>(() => {
    const layers = pickLooks(names ? names.split("|") : undefined, table);
    if (!layers.length) return undefined;
    const state: LookState = { ...NO_LOOK_STATE, invalid, width };
    const out: ResolvedFieldLook = {};
    for (const layer of layers)
      for (const k of Object.keys(layer) as (keyof AntFieldLook)[])
        out[k] = { ...out[k], ...atToken(layer[k], token, state) };
    return out;
  }, [table, names, token, width, invalid]);
  // The names Ant's looks lack, from the html looks in scope, under Ant's own.
  const html = useHtmlLookFallback("field", look, (n) => table?.[n] !== undefined, base);
  let resolved = own;
  let classes: FieldLookClasses | undefined;
  if (html.look) {
    resolved = {};
    classes = {};
    for (const k of Object.keys(HTML_FIELD_PARTS) as (keyof AntFieldLook)[]) {
      const style = html.style(HTML_FIELD_PARTS[k]);
      if (style || own?.[k]) resolved[k] = { ...style, ...own?.[k] };
      classes[k] = html.className(HTML_FIELD_PARTS[k]);
    }
  }
  // Stable without an html look; with one, its parts are new each render.
  const lookContext = useMemo(
    () => ({ look: resolved, classes, attr: lookAttr(look) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolved, classes, names],
  );
  const part = (name: keyof AntFieldLook) => resolved?.[name];
  const cls = (...parts: (keyof AntFieldLook)[]) =>
    parts.map((k) => classes?.[k]).filter(Boolean).join(" ") || undefined;
  // A radio option's wrapper: the html look's `entry`, and its state's part.
  const entryClass = (selected: boolean, base: string) =>
    html.className(["entry", selected ? "selected" : "notSelected"], base);
  return { part, cls, entryClass, lookContext };
}

function AntFieldShell(p: FieldShellProps) {
  const css = useCss();
  const { token } = theme.useToken();
  const { look: fieldLook, classes: fieldClasses, attr: fieldAttr } = useContext(AntFieldLookContext);
  const shellStyle = fieldLook?.shell;
  const labelStyle = fieldLook?.label;
  const labelClass = fieldClasses?.label;
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
        aria-label={helpButtonName("Help", p.label, p.helpLabel)}
        icon={webIcon({ name: "info" })}
        style={{ color: token.colorTextDescription }}
      >
        {p.helpLabel}
      </Button>
    </AntTooltip>
  );
  const ownLabel = labelEnd && p.labelPosition !== "after" && p.label != null && !p.hideLabel;
  // A label beside its control (a checkbox's `labelPosition: "before"`) when
  // the shell draws the label row itself: the row and the control on one
  // line, the control at its end — Form.Item's own horizontal layout only
  // reaches its own label.
  const beside = ownLabel && p.orientation === "horizontal";
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
            <span id={fieldLabelId(p.id)} className={labelClass} style={labelStyle}>{p.label}</span>
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
      // Spacing is the container's (the group body's gap), as under html.
      // Explicitly none: Ant's own margin is one an error message takes
      // over, which left a display after a field in error flush against it.
      className={fieldClasses?.shell}
      style={{ ...({ marginBottom: 0 }), ...shellStyle, ...css(p.style) }}
      data-look={fieldAttr}
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
      {ownLabel && !beside && (
        <Flex align="center" gap={token.marginXXS} style={{ paddingBottom: token.paddingXS }}>
          {p.labelAs === "legend" ? (
            <div id={fieldLabelId(p.id)} className={labelClass} style={{ color: token.colorTextHeading, ...labelStyle }}>
              {marker}
              {p.label}
            </div>
          ) : (
            <label htmlFor={p.id} id={fieldLabelId(p.id)} className={labelClass} style={{ color: token.colorTextHeading, ...labelStyle }}>
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
            className={labelClass}
            style={{
              cursor: p.disabled ? "not-allowed" : "pointer",
              // Ant greys its own label from a class on the wrapper, which a
              // sibling label never gets — so the shell maps it by hand.
              color: p.disabled ? token.colorTextDisabled : undefined,
              ...labelStyle,
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
      ) : beside ? (
        <Flex align="center" justify="space-between" gap={token.marginXS}>
          <Flex align="center" gap={token.marginXXS}>
            <label htmlFor={p.id} id={fieldLabelId(p.id)} className={labelClass} style={{ color: token.colorTextHeading, ...labelStyle }}>
              {marker}
              {p.label}
            </label>
            {helpButton}
          </Flex>
          {p.children}
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
  const css = useCss();
  const { token } = theme.useToken();
  const { look: fieldLook, classes: fieldClasses } = useContext(AntFieldLookContext);
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
  const slot = (s: IconSpec | ((s: FrameState) => IconSpec)) =>
    webIcon(typeof s === "function" ? s(state) : s);
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={fieldClasses?.control}
      style={{ ...({
        display: "inline-flex",
        alignItems: p.multiline ? "flex-start" : "center",
        gap: token.paddingXXS,
        width: "100%",
        // Ant's reset.css makes everything border-box; it is the app's to
        // load, so a full-width frame must not count on it.
        boxSizing: "border-box",
        padding: `${token.paddingXXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadius,
        // Longhands, not `border`: a field look may set the width alone, and
        // React warns about a shorthand mixed with its parts.
        borderWidth: 1,
        borderStyle: "solid",
        borderColor,
        boxShadow: focused
          ? `0 0 0 2px ${p.invalid ? token.colorErrorBorder : token.controlOutline}`
          : undefined,
        background: p.disabled
          ? token.colorBgContainerDisabled
          : token.colorBgContainer,
        color: p.disabled ? token.colorTextDisabled : token.colorText,
        transition: "all .2s",
      }), ...fieldLook?.control, ...css(p.style) }}
    >
      {p.start !== undefined && (
        <span style={{ color: token.colorTextPlaceholder }}>
          {slot(p.start)}
        </span>
      )}
      {p.render(
        {
          id: p.id,
          className: fieldClasses?.text,
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
            ...fieldLook?.text,
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
  const { lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useTextInput(p.field);
  // Renderer-specific props arrive unresolved; resolve them here, in this
  // window — and before the frame's render prop, which runs in the frame's.
  const placeholder = getProp(ctl.rc, p.placeholder);
  const inputType = getProp(ctl.rc, p.inputType) ?? "text";
  // A host's date control, in place of the browser's date input (`DateInputProvider`).
  const DateControl = useDateInput();
  const dateMode = dateModeOf(inputType);
  const multiline = !!getProp(ctl.rc, p.multiline);
  const inputMode = getProp(ctl.rc, p.inputMode);
  const autoComplete = getProp(ctl.rc, p.autoComplete);
  const maxLength = getProp(ctl.rc, p.maxLength);
  const count = countText(ctl.value, getProp(ctl.rc, p.showCount), maxLength);
  const countOver = maxLength !== undefined && ctl.value.length > maxLength;
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      style={p.shellStyle}
    >
      <Frame
        widget="textfield"
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
        style={p.style}
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
          if (DateControl && dateMode && !s.multiline)
            return drawDateInput(DateControl, dateMode, slot, ctl, { placeholder, className: common.className, style: common.style });
          return s.multiline ? (
            <textarea {...common} rows={3} />
          ) : (
            dateMode ? (
              // The browser's own picker, its value converted: `datetime-local` has no zone.
              <input
                {...common}
                type={dateMode === "datetime" ? "datetime-local" : dateMode}
                value={toBrowserDateValue(dateMode, ctl.value)}
                onChange={(e: { target: { value: string } }) => ctl.setValue(fromBrowserDateValue(dateMode, e.target.value))}
              />
            ) : (
              <input {...common} type={inputType} />
            )
          );
        }}
      />
    </Shell>
    </AntFieldLookContext.Provider>,
  );
}

function AntDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const css = useCss();
  const { part, cls, lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const { token } = theme.useToken();
  // The icons either side of the value, spaced as Ant spaces an affix.
  const icon = (spec: IconSpec, side: "start" | "end") =>
    spec != null && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          [side === "start" ? "marginInlineEnd" : "marginInlineStart"]:
            token.marginXXS,
        }}
      >
        {webIcon(spec)}
      </span>
    );
  const start = icon(p.startIcon, "start");
  const end = icon(p.endIcon, "end");
  // Ant's Text is already a span; inline only drops the shell.
  if (p.inline)
    return ctl.rendered(
      <Typography.Text
        id={p.id}
        style={css(p.style)}
      >
        {start}
        {ctl.content}
        {end}
      </Typography.Text>,
    );
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      style={p.shellStyle}
    >
      <Typography.Text
        id={p.id}
        className={cls("control", "text")}
        style={{
          ...(p.noSelection ? { userSelect: "none" } : undefined),
          ...part("control"),
          ...part("text"),
          ...css(p.style),
        }}
      >
        {start}
        {ctl.content}
        {end}
      </Typography.Text>
    </Shell>
    </AntFieldLookContext.Provider>,
  );
}

/** Ant puts the label *inside* the control — it is the checkbox's child. */
function AntCheckbox(p: CheckboxRenderProps): Rendered {
  const { part, cls, lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      style={p.shellStyle}
    >
      <Checkbox
        ref={ctl.elementRef}
        id={p.id}
        className={cls("control")}
        style={part("control")}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>
    </AntFieldLookContext.Provider>,
  );
}

/** A portable style as inline CSS, its colour tokens from the html theme. */
function useCss(): (s: PortableStyle | undefined) => CSSProperties | undefined {
  const { tokens } = useHtmlTheme();
  return (s) => portableCss(s, tokens.colors);
}

/**
 * Ant's own checkboxes in a labelled group. Not `Checkbox.Group`: it keys its
 * value by option value, which would lose a numeric choice's type, and takes
 * no ids for the shell's name and description.
 */
function AntCheckList(p: CheckListRenderProps): Rendered {
  const css = useCss();
  const { part, cls, lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      style={p.shellStyle}
    >
      <div
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={requiredDescribedBy(p)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={cls("control", "text")}
        style={{ ...part("control"), ...part("text"), ...css(p.style) }}
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
    </Shell>
    </AntFieldLookContext.Provider>,
  );
}

function AntTabs(p: TabsRenderProps) {
  const css = useCss();
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
        style={css(p.style)}
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

/** The three emphases as Ant's own button types. */
const emphasis = { primary: "primary", secondary: "default", link: "link", group: "text" } as const;

/** The `group` emphasis: no button, only a pressable wrapper around its children. */
const groupStyle = { padding: 0, height: "auto", textAlign: "left" } as const;

/**
 * A busy action's spinner, drawn as the button's icon rather than through
 * Ant's `loading`: Ant's own loading icon carries `aria-label="loading"` into
 * the button's name ("loading Submit"), and its loading state lags the prop by
 * a render, so the icon came back as busy ended and left on a CSS transition —
 * staying, named, wherever that transition never finished. The action is
 * already disabled while busy.
 */
const busyIcon = (
  <span aria-hidden="true" style={{ display: "inline-flex" }}>
    <Spin size="small" />
  </span>
);

function AntAction(p: ActionRenderProps) {
  const css = useCss();
  const { token } = theme.useToken();
  const table = useAntdLooks().action;
  const own = (n: string) => n in emphasis || table?.[n] !== undefined;
  const { props: named, style, needsState } = mergeLayers(
    useLookLayers("action", p.look, table, (n) => n in emphasis),
  );
  // The names Ant's looks lack, from the html looks in scope.
  const html = useHtmlLookFallback("action", p.look, own, { disabled: !!p.disabled });
  const actionWidth = useLookWidth(needsState);
  const builtin = lookNames(p.look)
    .map((n) => emphasis[n as keyof typeof emphasis])
    .filter(Boolean)
    .pop();
  return (
    <DisplayShell inline={true} kind="action" style={css(p.shellStyle)}>
      <Button
        type={builtin ?? "default"}
        size="small"
        {...named}
        {...html.pointer}
        className={html.className("control")}
        style={{
          ...(lookNames(p.look).includes("group") ? groupStyle : {}),
          ...html.style("control"),
          ...(atToken(style, token, { ...NO_LOOK_STATE, width: actionWidth })),
          ...css(p.style),
        }}
        data-look={lookAttr(p.look)}
        disabled={p.disabled}
        aria-busy={p.busy || undefined}
        icon={p.busy ? busyIcon : webIcon(p.icon)}
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
              <span className={html.className("text")} style={html.style("text")}>
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
/** A group's look as styles, each resolved against the tokens. */
function useGroupStyle(look: LookRef | undefined): GroupLookStyle | undefined {
  const { token } = theme.useToken();
  const group = useAntdLooks().group;
  const found = pickLooks(look, group);
  const width = useLookWidth(found.some((l) => Object.values(l).some(isFn)));
  if (!found.length) return undefined;
  const state: LookState = { ...NO_LOOK_STATE, width };
  const part = (k: "wrapper" | "title" | "body") => {
    const layers = found.map((l) => atToken(l[k], token, state)).filter(Boolean);
    return layers.length ? Object.assign({}, ...layers) : undefined;
  };
  return { wrapper: part("wrapper"), title: part("title"), body: part("body") };
}

/** The image as DOM, a look's style resolved against the tokens. */
function AntImage(p: ImageDisplayRenderProps) {
  const { token } = theme.useToken();
  const images = useAntdLooks().image;
  const toneStyle = useToneStyle(p.tone);
  const width = useLookWidth(lookNames(p.look).some((n) => isFn(images?.[n])));
  const state: LookState = { ...NO_LOOK_STATE, width };
  return (
    <ImageDom
      {...p}
      toneStyle={toneStyle}
      lookStyle={(v) => (images?.[v] === undefined ? undefined : atToken(images[v], token, state))}
    />
  );
}

/** Rich text as DOM, its links Ant's own. */
function AntRichText(p: RichTextRenderProps) {
  return (
    <RichTextDom
      {...p}
      link={(n, ch, k) => (
        <Typography.Link key={k} href={n.href} target={n.target} rel={n.target === "_blank" ? "noopener noreferrer" : undefined}>
          {ch}
        </Typography.Link>
      )}
    />
  );
}

/** Whether Ant's group looks hold a name: its own look, not the html theme's. */
function useOwnGroupLook(): (name: string) => boolean {
  const group = useAntdLooks().group;
  return (n) => group?.[n] !== undefined;
}

function AntInline(p: GroupRenderProps) {
  return <Inline {...p} lookStyle={useGroupStyle(p.look)} ownLook={useOwnGroupLook()} />;
}

function AntContents(p: GroupRenderProps) {
  const { token } = theme.useToken();
  return (
    <ContentsRegion
      {...p}
      lookStyle={useGroupStyle(p.look)}
      ownLook={useOwnGroupLook()}
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
  const css = useCss();
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const { token } = theme.useToken();
  const content = getProp(rc, p.text) ?? p.children;
  // A heading by role, in a group title's type at this level.
  const heading = !p.inline && !!getProp(rc, p.heading);
  const texts = useAntdLooks().text;
  const { props: look, style: lookStyle, needsState: textNeeds } = mergeLayers(
    useLookLayers("text", p.look, texts),
  );
  const html = useHtmlLookFallback("text", p.look, (n) => texts?.[n] !== undefined);
  const textWidth = useLookWidth(textNeeds);
  return rendered(
    <DisplayShell
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      style={{ ...toneStyle, ...css(p.shellStyle) }}
    >
      <Typography.Text
        {...look}
        className={html.className(["control", "text"])}
        // Ant's Typography sets its own colour; inherit the shell's tone.
        style={{ ...({
          ...(heading ? { display: "block", ...headingStyle(token, p.headingLevel) } : {}),
          ...html.style(["control", "text"]),
          ...atToken(lookStyle, token, { ...NO_LOOK_STATE, width: textWidth }),
          ...(p.tone ? { color: "inherit" } : {}),
        }), ...css(p.style) }}
        data-look={lookAttr(p.look)}
        {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
      >
        <span>
          {content}
        </span>
      </Typography.Text>
    </DisplayShell>,
  );
}

function AntIcon(p: IconDisplayRenderProps) {
  const css = useCss();
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const { token } = theme.useToken();
  const icons = useAntdLooks().icon;
  const iconLayers = useLookLayers("icon", p.look, icons);
  const html = useHtmlLookFallback("icon", p.look, (n) => icons?.[n] !== undefined);
  const iconWidth = useLookWidth(iconLayers.some(isFn));
  const look: AntStyle | undefined = iconLayers.length
    ? (t, st) => Object.assign({}, ...iconLayers.map((l) => atToken(l, t, st)))
    : undefined;
  const glyph = (
    <span
      role="img"
      aria-label={p.accessibleName}
      data-look={lookAttr(p.look)}
      className={html.className(["control", "text", "icon"])}
      style={{ ...({ fontSize: 24, lineHeight: 1, ...html.style(["control", "text", "icon"]), ...(look === undefined ? undefined : atToken(look, token, { ...NO_LOOK_STATE, width: iconWidth })) }), ...css(p.style) }}
    >
      {webIcon(getProp(rc, p.icon), false)}
    </span>
  );
  return rendered(
    <DisplayShell
      inline={true}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly}
      style={{ ...toneStyle, ...css(p.shellStyle) }}
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
  const css = useCss();
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const html = getProp(rc, p.html);
  return rendered(
    <DisplayShell
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      style={{ ...toneStyle, ...css(p.shellStyle) }}
    >
      <Typography
        style={{ ...(p.tone ? { color: "inherit" } : undefined), ...css(p.style) }}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
    </DisplayShell>,
  );
}

function AntSelect(p: SelectRenderProps): Rendered {
  const { part, cls, lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      helpLabel={p.helpLabel}
      error={p.error}
      style={p.shellStyle}
    >
      <AntSelectWithEnd end={webIcon(p.endIcon)}>
        <Select
          ref={ctl.elementRef}
          className={cls("control", "text")}
          style={{ ...part("control"), ...part("text") }}
          id={p.id}
          prefix={webIcon(p.startIcon) ?? undefined}
          aria-describedby={describedBy(p)}
          aria-invalid={p.error ? true : undefined}
          aria-required={p.required || undefined}
          value={ctl.stringValue === "" ? undefined : ctl.stringValue}
          placeholder={getProp(ctl.rc, p.placeholder)}
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
    </Shell>
    </AntFieldLookContext.Provider>,
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
  const css = useCss();
  const { part, cls, entryClass, lookContext } = useAntFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const entries = ctl.options.map((o) => ({
    o,
    selected: ctl.stringValue === String(o.value),
  }));
  return ctl.rendered(
    <AntFieldLookContext.Provider value={lookContext}>
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
      style={p.shellStyle}
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
        className={cls("control", "text")}
        style={{ ...part("control"), ...part("text"), ...css(p.style) }}
      >
        <Flex vertical gap={8}>
          {entries.map(({ o, selected }, i) => (
            <div key={keys[i]} className={entryClass(selected, "rxf-radio-entry")}>
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
    </Shell>
    </AntFieldLookContext.Provider>,
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
  const css = useCss();
  const { token } = theme.useToken();
  // A disclosure's look is a group's: the wrapper around it, the toggle row (its title), the content.
  const look = useGroupStyle(p.look);
  const groups = useAntdLooks().group;
  useLookLayers("disclosure", p.look, groups);
  // The html look's container and toggle row, for a name Ant's looks lack.
  const html = useHtmlLookFallback("disclosure", p.look, (n) => groups?.[n] !== undefined, {
    invalid: !!p.invalid,
  });
  return (
    <Collapse
      className={html.className("shell")}
      style={{ ...html.style("shell"), ...look?.wrapper, ...(p.hidden ? { display: "none" } : undefined), ...css(p.style) }}
      activeKey={p.open ? ["panel"] : []}
      onChange={(keys) => p.setOpen((Array.isArray(keys) ? keys : [keys]).length > 0)}
      destroyOnHidden={false}
      data-invalid={p.invalid ? "" : undefined}
      items={[
        {
          key: "panel",
          forceRender: true,
          label: (
            <span
              className={html.className("control")}
              style={{ ...html.style("control"), ...look?.title, ...(p.invalid ? { color: token.colorError } : {}) }}
            >
              {p.title}
            </span>
          ),
          children: (
            <div id={p.id} style={look?.body}>
              {p.content}
            </div>
          ),
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
          look="secondary"
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
  richText: AntRichText,
  image: AntImage,
  action: AntAction,
  contents: AntContents,
  inline: AntInline,
  wizard: AntWizard,
  dialog: AntDialog,
  disclosure: AntDisclosure,
  tabs: AntTabs,
  elements: ElementsList,
  feed: AntFeed,
  visibility: DefaultVisibility,
  form: FormElement,
  fieldShell: AntFieldShell,
  inputFrame: AntInputFrame,
  root: ({ children }) => <ConfigProvider>{children}</ConfigProvider>,
};

/** The web feed, with Ant's spinner; its "Load more" is Ant's own button through the action slot. */
function AntFeed(p: FeedRenderProps<unknown>) {
  return <FeedList {...p} spinner={<Spin />} />;
}
