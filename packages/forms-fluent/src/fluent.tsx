import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
} from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  FieldContextProvider,
  FluentProvider,
  Input,
  InfoButton,
  InfoLabel,
  Label,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  SSRProvider,
  Tab,
  TabList,
  Text,
  Textarea,
  Tooltip,
  tokens,
  typographyStyles,
  useIsSSR,
  useThemeClassName,
  webLightTheme,
  Link as FluentLink,
} from "@fluentui/react-components";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  countText,
  describedBy,
  fieldCountId,
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
  type ControlSlotProps,
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
import { atState, useFluentLooks, type FluentFieldLook, type FluentStyle } from "./looks.js";

// ── Root: inherit the host's theme ────────────────────────────────────
//
// A Fluent app already has a `FluentProvider`, and a second one with a theme
// would replace the host's. So the root adds nothing under a provider, and
// supplies Fluent's light theme only when there is none — a provider with no
// theme and no parent warns, which is console output in every consumer. With
// it goes `SSRProvider`, which a Fluent app's server setup carries: without
// one, Fluent's portals (a dialog's) render on the server, and React throws.

function FluentRoot({ children }: { children: ReactNode }) {
  if (useThemeClassName()) return <>{children}</>;
  return (
    <SSRProvider>
      <FluentProvider theme={webLightTheme}>{children}</FluentProvider>
    </SSRProvider>
  );
}

// ── Shell: Fluent's `Field`, cut off from the control ────────────────
//
// `Field` hands its own ids and ARIA to any Fluent control below it through
// context: the control's `aria-describedby` would become its error, its help,
// then ours again, an `aria-labelledby` would be added, and the label's `for`
// would point at an id of its own. The contract's ids are the shell's to
// render, so the context is cut and the ids go on Field's own slots.

/** A portable style as inline CSS, its colour tokens from the html theme. */
function useCss(): (s: PortableStyle | undefined) => CSSProperties | undefined {
  const { tokens } = useHtmlTheme();
  return (s) => portableCss(s, tokens.colors);
}

/**
 * The look a field was given, for its shell and its frame: they are drawn by
 * components the field does not own (a host may replace either), so it
 * travels privately — set by the field, read by the pair.
 */
type ResolvedFieldLook = { [P in keyof FluentFieldLook]?: CSSProperties };
/** The html look's classes on the same elements (see `useHtmlLookFallback`). */
type FieldLookClasses = { [P in keyof FluentFieldLook]?: string };
const FluentFieldLookContext = createContext<{
  look?: ResolvedFieldLook;
  classes?: FieldLookClasses;
  attr?: string;
}>({});

/** The html look's parts each of a field's elements carries. */
const HTML_FIELD_PARTS: Record<keyof FluentFieldLook, LookPartName | LookPartName[]> = {
  shell: "shell",
  label: ["label", "labelText"],
  control: "control",
  text: "text",
};

const isFn = (v: unknown): boolean => typeof v === "function";

/**
 * A look's layers merged, later over earlier: each prop a later layer names
 * replaces the earlier's, and the styles are laid in order — so a list of looks
 * layers as it does under html. `style` comes back as one style (a function of
 * the state), and `needsState` says whether any layer's is a function.
 */
function mergeLayers<T extends { style?: FluentStyle }>(
  layers: readonly T[],
): { props: Omit<T, "style">; style: FluentStyle | undefined; needsState: boolean } {
  let props = {} as Omit<T, "style">;
  for (const { style: _s, ...rest } of layers) props = { ...props, ...rest };
  const styled = layers.filter((l) => l.style !== undefined);
  return {
    props,
    needsState: styled.some((l) => isFn(l.style)),
    style: styled.length
      ? (state) => Object.assign({}, ...styled.map((l) => atState(l.style, state)))
      : undefined,
  };
}

/** A field's named look, and the context value that hands it to its shell and frame. */
function useFluentFieldLook(look: LookRef | undefined, base?: Partial<LookState>) {
  const table = useFluentLooks().field;
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
      for (const k of Object.keys(layer) as (keyof FluentFieldLook)[])
        out[k] = { ...out[k], ...atState(layer[k], state) };
    return out;
  }, [table, names, width, invalid]);
  // The names Fluent's looks lack, from the html looks in scope, under Fluent's own.
  const html = useHtmlLookFallback("field", look, (n) => table?.[n] !== undefined, base);
  let resolved = own;
  let classes: FieldLookClasses | undefined;
  if (html.look) {
    resolved = {};
    classes = {};
    for (const k of Object.keys(HTML_FIELD_PARTS) as (keyof FluentFieldLook)[]) {
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
  const cls = (...parts: (keyof FluentFieldLook)[]) =>
    parts.map((k) => classes?.[k]).filter(Boolean).join(" ") || undefined;
  // A radio option's wrapper: the html look's `entry`, and its state's part.
  const entryClass = (selected: boolean, base: string) =>
    html.className(["entry", selected ? "selected" : "notSelected"], base);
  return { look: resolved, cls, entryClass, lookContext };
}

function FluentFieldShell(p: FieldShellProps) {
  const css = useCss();
  const { look: fieldLook, classes: fieldClasses, attr: fieldAttr } = useContext(FluentFieldLookContext);
  const labelClass = fieldClasses?.label;
  const labelText = (
    <span>
      {p.label}
    </span>
  );
  const control = (
    <FieldContextProvider value={undefined}>{p.children}</FieldContextProvider>
  );
  // `labelEnd` help: Fluent's own InfoLabel, whose info button sits beside
  // the <label>, not in it — so the field's name stays its label. Its
  // popover shows the help; for assistive technology the help is also
  // rendered visually hidden under its id, as the control's description.
  const labelEnd = labelEndHelp(p);
  // A field's own words go on the button beside the glyph (its children replace the default icon).
  const helpWords =
    p.helpLabel != null
      ? {
          children: (
            <>
              {webIcon({ name: "info" })}
              <span style={{ marginInlineStart: 4, fontWeight: 700 }}>{p.helpLabel}</span>
            </>
          ),
          style: { width: "auto" },
        }
      : {};
  const infoButton = labelEnd && (
    <InfoButton
      info={{ children: p.helpText }}
      {...helpWords}
      aria-label={helpButtonName("Help", p.label, p.helpLabel)}
    />
  );
  return (
    <Field
      orientation={p.orientation}
      className={fieldClasses?.shell}
      style={{ ...fieldLook?.shell, ...css(p.style) }}
      data-look={fieldAttr}
      label={
        p.labelPosition === "after" || p.label == null || p.hideLabel
          ? undefined
          : {
              id: fieldLabelId(p.id),
              className: labelClass,
              style: fieldLook?.label,
              // A group's label names it by id; with Field's default `for`
              // it would also point at a control that does not exist.
              htmlFor: p.labelAs === "legend" ? undefined : p.id,
              required: p.required,
              disabled: p.disabled,
              children: labelEnd
                ? (_: unknown, props: object) => (
                    <InfoLabel
                      {...props}
                      id={fieldLabelId(p.id)}
                      htmlFor={p.labelAs === "legend" ? undefined : p.id}
                      required={p.required}
                      disabled={p.disabled}
                      className={labelClass}
                      style={fieldLook?.label}
                      info={{ children: p.helpText }}
                      infoButton={{ ...helpWords, "aria-label": helpButtonName("Help", p.label, p.helpLabel) }}
                    >
                      {labelText}
                    </InfoLabel>
                  )
                : labelText,
            }
      }
      validationState={p.error ? "error" : "none"}
      validationMessage={
        p.error
          ? // Not `role="alert"`, which Field adds: a field's error is read
            // through the control's description, as under html, and an alert
            // per invalid field would announce over the form's own.
            { id: fieldErrorId(p.id), role: undefined, children: p.error }
          : undefined
      }
      // The help, then the count: both in Field's hint, which it draws
      // under the control. The help gives way to an error; the count stays.
      hint={
        (!p.error && p.helpText && !labelEnd) || p.count != null
          ? {
              children: (
                <>
                  {!p.error && p.helpText && !labelEnd && (
                    <span id={fieldHelpId(p.id)} style={{ display: "block" }}>
                      {p.helpText}
                    </span>
                  )}
                  {p.count != null && (
                    <span
                      id={fieldCountId(p.id)}
                      style={{
                        display: "block",
                        color: p.countOver
                          ? tokens.colorStatusDangerForeground1
                          : undefined,
                      }}
                    >
                      {p.count}
                    </span>
                  )}
                </>
              ),
            }
          : undefined
      }
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
          {infoButton}
          {control}
        </>
      ) : p.labelPosition === "after" ? (
        // Fluent's checkbox takes its label as a slot of its own, which a
        // shell cannot reach into — so the trailing label is a sibling.
        <span style={{ display: "flex", alignItems: "center" }}>
          {control}
          <Label
            htmlFor={p.id}
            id={fieldLabelId(p.id)}
            required={p.required}
            disabled={p.disabled}
            className={labelClass}
            style={fieldLook?.label}
          >
            {labelText}
          </Label>
          {infoButton}
        </span>
      ) : (
        <>
          {p.label == null && infoButton}
          {control}
        </>
      )}
    </Field>
  );
}

// ── Frame: Fluent's own Input, the control in its slot ────────────────
//
// Fluent's slots take a render function, so the contract's render prop runs
// inside Fluent's `input` (or `textarea`) slot: the border, focus underline
// and `contentBefore`/`contentAfter` are the library's own, with nothing
// restated. The function is called, not mounted, so the control keeps its
// node across the frame's re-renders. Fluent derives its invalid chrome from
// `aria-invalid` on the slot's *props*, so it goes there as well.

function FluentInputFrame(p: InputFrameProps) {
  const css = useCss();
  const { look: fieldLook, classes: fieldClasses } = useContext(FluentFieldLookContext);
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
    webIcon(typeof s === "function" ? s(state) : s);
  const control = {
    "aria-invalid": p.invalid || undefined,
    children: (_: unknown, fluent: { className?: string }) => {
      const props: ControlSlotProps = {
        id: p.id,
        // Fluent's own styling of the control: no border, inherits the frame.
        className: [fluent.className, fieldClasses?.text].filter(Boolean).join(" ") || undefined,
        style: fieldLook?.text,
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        disabled: p.disabled,
        readOnly: p.readOnly,
        "aria-invalid": p.invalid || undefined,
        "aria-required": p.required || undefined,
        "aria-describedby": p.describedBy,
        ref: p.controlRef,
      };
      return p.render(props, state);
    },
  };
  if (p.multiline) {
    // Textarea has no content slots: adornments sit beside it.
    const area = (
      <Textarea
        className={fieldClasses?.control}
        style={{ ...fieldLook?.control, ...css(p.style) }}
        disabled={p.disabled}
        resize="vertical"
        textarea={control as never}
      />
    );
    return p.start === undefined && p.end === undefined ? (
      area
    ) : (
      <span style={{ display: "flex", alignItems: "flex-start", gap: tokens.spacingHorizontalXS }}>
        {p.start !== undefined && slot(p.start)}
        {area}
        {p.end !== undefined && slot(p.end)}
      </span>
    );
  }
  return (
    <Input
      className={fieldClasses?.control}
      style={{ ...fieldLook?.control, ...css(p.style) }}
      disabled={p.disabled}
      contentBefore={p.start !== undefined ? <>{slot(p.start)}</> : undefined}
      contentAfter={p.end !== undefined ? <>{slot(p.end)}</> : undefined}
      input={control as never}
    />
  );
}

function FluentTextField(p: TextFieldRenderProps): Rendered {
  const { lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
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
    <FluentFieldLookContext.Provider value={lookContext}>
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
    </FluentFieldLookContext.Provider>,
  );
}

function FluentDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const css = useCss();
  const { look: fieldLook, cls, lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  // The icons either side of the value, spaced as Fluent spaces an
  // `Input`'s content slots.
  const icon = (spec: IconSpec, side: "start" | "end") =>
    spec != null && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          [side === "start" ? "marginInlineEnd" : "marginInlineStart"]:
            tokens.spacingHorizontalXS,
        }}
      >
        {webIcon(spec)}
      </span>
    );
  const text = (
    <Text
      id={p.id}
      className={cls("control", "text")}
      style={{
        ...(p.noSelection ? { userSelect: "none" } : undefined),
        ...fieldLook?.control,
        ...fieldLook?.text,
        ...css(p.style),
      }}
    >
      {icon(p.startIcon, "start")}
      {ctl.content}
      {icon(p.endIcon, "end")}
    </Text>
  );
  // Fluent's Text is already a span; inline only drops the shell.
  if (p.inline) return ctl.rendered(text);
  return ctl.rendered(
    <FluentFieldLookContext.Provider value={lookContext}>
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
      {text}
    </Shell>
    </FluentFieldLookContext.Provider>,
  );
}

/**
 * Fluent's `Select` has no content slots, so a select's icons sit beside it,
 * as a multiline frame's do beside `Textarea`.
 */
function BesideSelect(p: { start?: ReactNode; end?: ReactNode; children: ReactNode }) {
  if (p.start == null && p.end == null) return <>{p.children}</>;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS }}>
      {p.start}
      <span style={{ flex: 1, minWidth: 0 }}>{p.children}</span>
      {p.end}
    </span>
  );
}

function FluentCheckbox(p: CheckboxRenderProps): Rendered {
  const { look: fieldLook, cls, lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  return ctl.rendered(
    <FluentFieldLookContext.Provider value={lookContext}>
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
        style={fieldLook?.control}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(_, d) => ctl.setChecked(!!d.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>
    </FluentFieldLookContext.Provider>,
  );
}

/** Fluent has no checkbox group: its checkboxes in a labelled `role="group"`. */
function FluentCheckList(p: CheckListRenderProps): Rendered {
  const css = useCss();
  const { look: fieldLook, cls, lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <FluentFieldLookContext.Provider value={lookContext}>
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
        style={{
          ...({ display: "flex", flexDirection: "column" }),
          ...fieldLook?.control,
          ...fieldLook?.text,
          ...css(p.style),
        }}
      >
        {ctl.options.map((o, i) => (
          <Checkbox
            key={keys[i]}
            ref={i === 0 ? ctl.elementRef : undefined}
            label={o.name}
            aria-invalid={p.error ? true : undefined}
            checked={ctl.isSelected(o)}
            disabled={locked || o.disabled}
            onChange={(_, d) => ctl.setSelected(o, !!d.checked)}
          />
        ))}
      </div>
    </Shell>
    </FluentFieldLookContext.Provider>,
  );
}

/** Fluent's `Select` is a native `<select>`: the string round-trip for free. */
function FluentSelect(p: SelectRenderProps): Rendered {
  const css = useCss();
  const { look: fieldLook, cls, lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  return ctl.rendered(
    <FluentFieldLookContext.Provider value={lookContext}>
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
      <BesideSelect start={webIcon(p.startIcon)} end={webIcon(p.endIcon)}>
        <Select
          ref={ctl.elementRef}
          id={p.id}
          className={cls("control")}
          style={{ ...fieldLook?.control, ...css(p.style) }}
          // The `<select>` itself is the text: Fluent's root is a wrapper around it.
          select={fieldLook?.text || cls("text") ? { className: cls("text"), style: fieldLook?.text } : undefined}
          aria-describedby={describedBy(p)}
          aria-invalid={p.error ? true : undefined}
          aria-required={p.required || undefined}
          value={ctl.stringValue}
          disabled={ctl.state.disabled || ctl.state.readOnly}
          onChange={(_, d) => ctl.setFromString(d.value)}
          onBlur={ctl.onBlur}
        >
          {/* A required select with a value has no way back to empty. */}
          {(!p.required || ctl.stringValue === "") && <option value="">{getProp(ctl.rc, p.placeholder)}</option>}
          {ctl.options.map((o, i) => (
            <option key={keys[i]} value={String(o.value)} disabled={o.disabled}>
              {o.name}
            </option>
          ))}
        </Select>
      </BesideSelect>
    </Shell>
    </FluentFieldLookContext.Provider>,
  );
}

function FluentRadio(p: RadioRenderProps): Rendered {
  const css = useCss();
  const { look: fieldLook, cls, entryClass, lookContext } = useFluentFieldLook(p.look, { invalid: !!p.error });
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <FluentFieldLookContext.Provider value={lookContext}>
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
      <RadioGroup
        name={p.id}
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        value={ctl.stringValue}
        onChange={(_, d) => ctl.setFromString(d.value)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={cls("control", "text")}
        style={{ ...fieldLook?.control, ...fieldLook?.text, ...css(p.style) }}
      >
        {ctl.options.map((o, i) => {
          const selected = ctl.stringValue === String(o.value);
          return (
            <div key={keys[i]} className={entryClass(selected, "rxf-radio-entry")}>
              <Radio
                ref={i === 0 ? ctl.elementRef : undefined}
                value={String(o.value)}
                label={o.name}
                disabled={locked || o.disabled}
                // Fluent copies the group's description onto every radio
                // unless one is given, and only `undefined` takes the copy.
                aria-describedby={null as never}
              />
              {p.children?.(o, selected)}
            </div>
          );
        })}
      </RadioGroup>
    </Shell>
    </FluentFieldLookContext.Provider>,
  );
}

/**
 * `TabList` is only the strip: the panels are ours, so every one stays
 * mounted without being told, and a hidden tab is simply left off the strip.
 * Fluent wires no `aria-controls`, so the tab ↔ panel ids are drawn here.
 */
function FluentTabs(p: TabsRenderProps) {
  const css = useCss();
  const id = useId();
  const tabId = (key: string) => `${id}-tab-${key}`;
  const panelId = (key: string) => `${id}-panel-${key}`;
  return (
    <div style={css(p.style)} hidden={p.hidden || undefined}>
      <TabList
        selectedValue={p.activeKey}
        onTabSelect={(_, d) => p.setActive(String(d.value))}
      >
        {p.items
          .filter((i) => !i.hidden)
          .map((i) => (
            <Tab
              key={i.key}
              value={i.key}
              id={tabId(i.key)}
              aria-controls={panelId(i.key)}
              data-invalid={i.invalid ? "" : undefined}
              style={
                i.invalid
                  ? { color: tokens.colorStatusDangerForeground1 }
                  : undefined
              }
            >
              {i.title}
            </Tab>
          ))}
      </TabList>
      {/* Every panel, always — an unmounted one validates nothing. */}
      {p.items.map((i) => (
        <div
          key={i.key}
          id={panelId(i.key)}
          role="tabpanel"
          aria-labelledby={i.hidden ? undefined : tabId(i.key)}
          data-inactive={i.active ? undefined : ""}
          hidden={!i.active || undefined}
          style={{ paddingTop: tokens.spacingVerticalM }}
        >
          {i.content}
        </div>
      ))}
    </div>
  );
}

/** The three emphases as Fluent's own button appearances. */
const emphasis = { primary: "primary", secondary: "secondary", link: "transparent", group: "transparent" } as const;

/** The `group` emphasis: no button, only a pressable wrapper around its children. */
const groupStyle = {
  padding: 0,
  minWidth: 0,
  height: "auto",
  justifyContent: "flex-start",
  textAlign: "left",
} as const;

function FluentAction(p: ActionRenderProps) {
  const css = useCss();
  const replace = p.iconPlacement === "replace";
  const icon = p.busy ? <Spinner size="extra-tiny" /> : webIcon(p.icon);
  const table = useFluentLooks().action;
  const own = (n: string) => n in emphasis || table?.[n] !== undefined;
  const { props: lookup, style: lookStyle, needsState: actionNeeds } = mergeLayers(
    useLookLayers("action", p.look, table, (n) => n in emphasis),
  );
  // The names Fluent's looks lack, from the html looks in scope.
  const html = useHtmlLookFallback("action", p.look, own, { disabled: !!p.disabled });
  const actionWidth = useLookWidth(actionNeeds);
  const builtin = lookNames(p.look)
    .map((n) => emphasis[n as keyof typeof emphasis])
    .filter(Boolean)
    .pop();
  return (
    <DisplayShell inline={true} kind="action" style={css(p.shellStyle)}>
      <Button
        appearance={builtin ?? "secondary"}
        size="small"
        {...lookup}
        {...html.pointer}
        className={html.className("control")}
        data-look={lookAttr(p.look)}
        style={{
          ...(lookNames(p.look).includes("group") ? groupStyle : {}),
          ...html.style("control"),
          ...atState(lookStyle, { ...NO_LOOK_STATE, width: actionWidth }),
          ...css(p.style),
        }}
        disabled={p.disabled}
        aria-busy={p.busy || undefined}
        icon={icon == null ? undefined : <>{icon}</>}
        iconPosition={p.iconPlacement === "after" ? "after" : "before"}
        // The default button is a submit, so Enter presses it; the click
        // runs the form's submission and the native one never happens.
        type={p.submit ? "submit" : "button"}
        onClick={(e) => {
          if (p.submit) e.preventDefault();
          p.onClick();
        }}
        aria-label={replace ? String(p.text) : undefined}
      >
        {replace
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

/**
 * A titled group: the shared region, its title in Fluent's type ramp. Sized
 * for a form section rather than by the outline's level — the top level takes
 * `subtitle1`, anything deeper `subtitle2`.
 */
/** The image as DOM, a look's style from the provider. */
function FluentImage(p: ImageDisplayRenderProps) {
  const images = useFluentLooks().image;
  const width = useLookWidth(lookNames(p.look).some((n) => isFn(images?.[n])));
  const state: LookState = { ...NO_LOOK_STATE, width };
  return <ImageDom {...p} toneStyle={toneStyle(p.tone)} lookStyle={(v) => atState(images?.[v], state)} />;
}

/** Rich text as DOM, its links Fluent's own. */
function FluentRichText(p: RichTextRenderProps) {
  return (
    <RichTextDom
      {...p}
      link={(n, ch, k) => (
        <FluentLink key={k} inline href={n.href} target={n.target} rel={n.target === "_blank" ? "noopener noreferrer" : undefined}>
          {ch}
        </FluentLink>
      )}
    />
  );
}

/** A group's look as styles, its function parts given the window's width. */
function useGroupStyle(look: LookRef | undefined) {
  const group = useFluentLooks().group;
  const found = pickLooks(look, group);
  const width = useLookWidth(found.some((l) => Object.values(l).some(isFn)));
  if (!found.length) return undefined;
  const state: LookState = { ...NO_LOOK_STATE, width };
  const part = (k: "wrapper" | "title" | "body") => {
    const layers = found.map((l) => atState(l[k], state)).filter(Boolean);
    return layers.length ? Object.assign({}, ...layers) : undefined;
  };
  return { wrapper: part("wrapper"), title: part("title"), body: part("body") };
}

/** Whether Fluent's group looks hold a name: its own look, not the html theme's. */
function useOwnGroupLook(): (name: string) => boolean {
  const group = useFluentLooks().group;
  return (n) => group?.[n] !== undefined;
}

function FluentInline(p: GroupRenderProps) {
  return <Inline {...p} lookStyle={useGroupStyle(p.look)} ownLook={useOwnGroupLook()} />;
}

function FluentContents(p: GroupRenderProps) {
  const top = (p.headingLevel ?? 2) <= 2;
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
        gap: tokens.spacingVerticalM,
      }}
      titleStyle={{
        ...(top ? typographyStyles.subtitle1 : typographyStyles.subtitle2),
        color: tokens.colorNeutralForeground1,
        marginBottom: tokens.spacingVerticalS,
      }}
    />
  );
}

/** A tone's colour from Fluent's status tokens, inherited by the text inside. */
function toneStyle(tone: Tone | undefined): CSSProperties | undefined {
  if (!tone) return undefined;
  const color = {
    error: tokens.colorStatusDangerForeground1,
    warning: tokens.colorStatusWarningForeground1,
    info: tokens.colorBrandForeground1,
    success: tokens.colorStatusSuccessForeground1,
  }[tone];
  return { color };
}

function FluentText(p: TextDisplayRenderProps) {
  const css = useCss();
  const { rc, rendered } = useReactive();
  const content = getProp(rc, p.text) ?? p.children;
  // A heading by role, in a group title's type at this level.
  const heading = !p.inline && !!getProp(rc, p.heading);
  const texts = useFluentLooks().text;
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
      style={{ ...toneStyle(p.tone), ...css(p.shellStyle) }}
    >
      <Text
        {...look}
        className={html.className(["control", "text"])}
        // Fluent's Text sets its own colour; inherit the shell's tone.
        style={{ ...({
          ...(heading
            ? {
                display: "block",
                ...(p.headingLevel <= 2 ? typographyStyles.subtitle1 : typographyStyles.subtitle2),
                color: tokens.colorNeutralForeground1,
              }
            : {}),
          ...html.style(["control", "text"]),
          ...atState(lookStyle, { ...NO_LOOK_STATE, width: textWidth }),
          ...(p.tone ? { color: "inherit" } : {}),
        }), ...css(p.style) }}
        data-look={lookAttr(p.look)}
        {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
      >
        <span>
          {content}
        </span>
      </Text>
    </DisplayShell>,
  );
}

function FluentIcon(p: IconDisplayRenderProps) {
  const css = useCss();
  const { rc, rendered } = useReactive();
  const icons = useFluentLooks().icon;
  const iconLayers = useLookLayers("icon", p.look, icons);
  const html = useHtmlLookFallback("icon", p.look, (n) => icons?.[n] !== undefined);
  const iconWidth = useLookWidth(iconLayers.some(isFn));
  const look = Object.assign(
    {},
    ...iconLayers.map((l) => atState(l, { ...NO_LOOK_STATE, width: iconWidth })),
  );
  const glyph = (
    <span
      role="img"
      aria-label={p.accessibleName}
      data-look={lookAttr(p.look)}
      className={html.className(["control", "text", "icon"])}
      style={{ ...({ fontSize: 24, lineHeight: 1, ...html.style(["control", "text", "icon"]), ...look }), ...css(p.style) }}
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
      style={{ ...toneStyle(p.tone), ...css(p.shellStyle) }}
    >
      {p.accessibleName ? (
        // The glyph is already named; a labelling tooltip would name it twice.
        <Tooltip content={p.accessibleName} relationship="inaccessible">
          {glyph}
        </Tooltip>
      ) : (
        glyph
      )}
    </DisplayShell>,
  );
}

function FluentHtml(p: HtmlDisplayRenderProps) {
  const css = useCss();
  const { rc, rendered } = useReactive();
  const html = getProp(rc, p.html);
  return rendered(
    <DisplayShell
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      style={{ ...toneStyle(p.tone), ...css(p.shellStyle) }}
    >
      <div
        style={{ ...({ ...typographyStyles.body1, ...(p.tone ? { color: "inherit" } : undefined) }), ...css(p.style) }}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
    </DisplayShell>,
  );
}

/** A layout effect, or on the server (where React warns of one) a passive one. */
const useCommitEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/** v9 has no stepper: the header is a list of the shown pages. */
function FluentWizard(p: WizardRenderProps) {
  // `none`: the pages only — the host's own actions move the wizard.
  const nav = p.navigation === "builtin";
  const shown = p.items.map((i, n) => ({ i, n })).filter(({ i }) => !i.hidden);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      {nav && (
        <ol
          style={{
            display: "flex",
            gap: tokens.spacingHorizontalS,
            listStyle: "none",
            padding: 0,
            margin: `0 0 ${tokens.spacingVerticalL}`,
          }}
        >
          {shown.map(({ i, n }, step) => (
            <li key={i.key} data-active={n === p.index ? "" : undefined}>
              <Button
                appearance={n === p.index ? "primary" : "subtle"}
                size="small"
                aria-current={n === p.index ? "step" : undefined}
                data-invalid={i.invalid ? "" : undefined}
                style={
                  i.invalid && n !== p.index
                    ? { color: tokens.colorStatusDangerForeground1 }
                    : undefined
                }
                onClick={() => p.goTo(n)}
              >
                {step + 1}{i.title != null && <>. {i.title}</>}
              </Button>
            </li>
          ))}
        </ol>
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
        <div style={{ display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalM }}>
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
 * Built from parts: Fluent's AccordionPanel unmounts a closed panel, which
 * would stop its fields validating. A subtle Button is the toggle
 * (`aria-expanded`, `aria-controls`), and the region is `hidden` while
 * closed — mounted, which is what `silent` needs.
 */
function FluentDisclosure(p: DisclosureRenderProps) {
  const css = useCss();
  // A disclosure's look is a group's: the wrapper around it, the toggle row (its title), the content.
  const look = useGroupStyle(p.look);
  const groups = useFluentLooks().group;
  useLookLayers("disclosure", p.look, groups);
  // The html look's container and toggle row, for a name Fluent's looks lack.
  const html = useHtmlLookFallback("disclosure", p.look, (n) => groups?.[n] !== undefined, {
    invalid: !!p.invalid,
  });
  return (
    <div
      className={html.className("shell")}
      style={{ ...html.style("shell"), ...look?.wrapper, ...(p.hidden ? { display: "none" } : undefined), ...css(p.style) }}
      data-invalid={p.invalid ? "" : undefined}
    >
      <Button
        appearance="transparent"
        aria-expanded={p.open}
        aria-controls={p.id}
        icon={<>{webIcon({ name: p.open ? "chevron-down" : "chevron-right" })}</>}
        className={html.className("control")}
        style={{
          paddingInline: 0,
          ...html.style("control"),
          ...look?.title,
          ...(p.invalid ? { color: tokens.colorStatusDangerForeground1 } : {}),
        }}
        onClick={() => p.setOpen(!p.open)}
      >
        {p.title}
      </Button>
      <div id={p.id} hidden={!p.open || undefined} style={{ paddingTop: tokens.spacingVerticalS, ...look?.body }}>
        {p.content}
      </div>
    </div>
  );
}

/**
 * `unmountOnClose={false}` keeps the body mounted, which `silent` needs — but
 * Fluent hides a closed surface only with opacity and `aria-hidden`, so a
 * control inside could still take focus, invisible. The closed surface is
 * therefore `inert`, set on the element since Fluent drops the prop. And opened from props rather than a `DialogTrigger`,
 * nothing returns focus on close, so the dialog does.
 *
 * Kept mounted, it also portals during hydration — Fluent's `Portal` makes its
 * mount node in the first client render — where the server rendered none, so
 * React would discard the server's tree. Under `SSRProvider` (which the root
 * supplies when the host has none) it waits for hydration to finish. The
 * server cannot judge a closed dialog's fields either way: they mount, and
 * start validating, on the client.
 */
function FluentDialog(p: DialogRenderProps) {
  const css = useCss();
  const opener = useRef<Element | null>(null);
  const wasOpen = useRef(p.open);
  // Set on the element: Fluent filters `inert` out of the surface's props.
  // In a layout effect, so it is lifted before Fluent's passive effect moves
  // focus into the surface on open — a child's, which runs before ours.
  const surface = useRef<HTMLDivElement>(null);
  useCommitEffect(() => {
    if (surface.current) surface.current.inert = !p.open;
  });
  // Read at render, before Fluent's effects move focus into the surface.
  if (p.open && !wasOpen.current && typeof document !== "undefined")
    opener.current = document.activeElement;
  useEffect(() => {
    if (wasOpen.current && !p.open) {
      const el = opener.current as HTMLElement | null;
      opener.current = null;
      if (el?.isConnected) el.focus();
    }
    wasOpen.current = p.open;
  }, [p.open]);
  const hydrating = useIsSSR();
  if (p.inline)
    return (
      <div
        style={{ ...({
          border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
          borderRadius: tokens.borderRadiusLarge,
          padding: tokens.spacingHorizontalL,
        }), ...css(p.style) }}
      >
        {p.title && (
          <div style={{ ...typographyStyles.subtitle2, marginBottom: tokens.spacingVerticalS }}>
            {p.title}
          </div>
        )}
        {p.content}
      </div>
    );
  if (hydrating) return null;
  return (
    <Dialog
      open={p.open}
      unmountOnClose={false}
      // Called only for a user dismissal (Escape, the backdrop): a close
      // made by the author's own code changes `open` and calls nothing.
      onOpenChange={(_, d) => {
        if (!d.open) p.onClose();
      }}
    >
      <DialogSurface
        ref={surface}
        style={css(p.style)}
      >
        <DialogBody>
          {p.title && <DialogTitle>{p.title}</DialogTitle>}
          <DialogContent>{p.content}</DialogContent>
          <DialogActions>
            <Action
              actionId={StandardActionIds.close}
              text="Close"
              look="secondary"
              onClick={p.onClose}
            />
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/**
 * The Fluent UI implementation: every registry slot drawn with Fluent UI
 * React v9 (`@fluentui/react-components`). Pass it to `FormProvider`; its
 * `root` uses the host's `FluentProvider` and theme when there is one, and
 * supplies `webLightTheme` only when there is none.
 *
 * Fluent is the implementation whose slots take a render function, so its
 * input frame *is* Fluent's own `Input` with the control in the `input` slot;
 * whose `Field` hands ids and ARIA to the control through context, which the
 * shell cuts so the contract's ids are the ones read; and whose kept-mounted
 * dialog has to be made `inert` while closed, or its hidden controls take
 * focus.
 *
 * @group Rendering
 */
export const fluentRenderers: FormRenderers = {
  name: "Fluent",
  textfield: FluentTextField,
  checkbox: FluentCheckbox,
  displayOnly: FluentDisplayOnly,
  select: FluentSelect,
  radio: FluentRadio,
  checkList: FluentCheckList,
  text: FluentText,
  html: FluentHtml,
  icon: FluentIcon,
  richText: FluentRichText,
  image: FluentImage,
  action: FluentAction,
  contents: FluentContents,
  inline: FluentInline,
  wizard: FluentWizard,
  dialog: FluentDialog,
  disclosure: FluentDisclosure,
  tabs: FluentTabs,
  elements: ElementsList,
  feed: FluentFeed,
  visibility: DefaultVisibility,
  form: FormElement,
  fieldShell: FluentFieldShell,
  inputFrame: FluentInputFrame,
  root: FluentRoot,
};

/** The web feed, with Fluent's spinner; its "Load more" is Fluent's own button through the action slot. */
function FluentFeed(p: FeedRenderProps<unknown>) {
  return <FeedList {...p} spinner={<Spinner size="small" />} />;
}
