import {
  useEffect,
  useId,
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
} from "@fluentui/react-components";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
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
  type ControlSlotProps,
  type FieldShellProps,
  type FormRenderers,
  type FrameState,
  type InputFrameProps,
  type TabsRenderProps,
  type GroupRenderProps,
  type WizardRenderProps,
  type DialogRenderProps,
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
} from "@rx-controls/forms-html/shared";

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

function FluentFieldShell(p: FieldShellProps) {
  const labelText = (
    <span className={mergeClass(undefined, p.labelTextClassName)}>
      {p.label}
    </span>
  );
  const control = (
    <FieldContextProvider value={undefined}>{p.children}</FieldContextProvider>
  );
  return (
    <Field
      orientation={p.orientation}
      className={mergeClass(undefined, p.className)}
      label={
        p.labelPosition === "after" || p.label == null
          ? undefined
          : {
              id: fieldLabelId(p.id),
              // A group's label names it by id; with Field's default `for`
              // it would also point at a control that does not exist.
              htmlFor: p.labelAs === "legend" ? undefined : p.id,
              required: p.required,
              disabled: p.disabled,
              className: mergeClass(undefined, p.labelClassName),
              children: labelText,
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
      hint={
        !p.error && p.helpText
          ? { id: fieldHelpId(p.id), children: p.helpText }
          : undefined
      }
    >
      {p.labelPosition === "after" ? (
        // Fluent's checkbox takes its label as a slot of its own, which a
        // shell cannot reach into — so the trailing label is a sibling.
        <span style={{ display: "flex", alignItems: "center" }}>
          {control}
          <Label
            htmlFor={p.id}
            id={fieldLabelId(p.id)}
            required={p.required}
            disabled={p.disabled}
            className={mergeClass(undefined, p.labelClassName)}
          >
            {labelText}
          </Label>
        </span>
      ) : (
        control
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
  const control = {
    "aria-invalid": p.invalid || undefined,
    children: (_: unknown, fluent: { className?: string }) => {
      const props: ControlSlotProps = {
        id: p.id,
        // Fluent's own styling of the control: no border, inherits the frame.
        className: fluent.className,
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
  const className = mergeClass(undefined, p.className);
  if (p.multiline) {
    // Textarea has no content slots: adornments sit beside it.
    const area = (
      <Textarea
        className={className}
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
      className={className}
      disabled={p.disabled}
      contentBefore={p.start !== undefined ? <>{slot(p.start)}</> : undefined}
      contentAfter={p.end !== undefined ? <>{slot(p.end)}</> : undefined}
      input={control as never}
    />
  );
}

function FluentTextField(p: TextFieldRenderProps): Rendered {
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

function FluentDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const text = (
    <Text
      id={p.id}
      className={mergeClass(undefined, p.className ?? p.textClassName)}
      style={p.noSelection ? { userSelect: "none" } : undefined}
    >
      {ctl.content}
    </Text>
  );
  // Fluent's Text is already a span; inline only drops the shell.
  if (p.inline) return ctl.rendered(text);
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
      {text}
    </Shell>,
  );
}

function FluentCheckbox(p: CheckboxRenderProps): Rendered {
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
        ref={ctl.elementRef}
        id={p.id}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(_, d) => ctl.setChecked(!!d.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

/** Fluent has no checkbox group: its checkboxes in a labelled `role="group"`. */
function FluentCheckList(p: CheckListRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
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
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={describedBy(p)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
        style={{ display: "flex", flexDirection: "column" }}
      >
        {ctl.options.map((o, i) => (
          <Checkbox
            key={keys[i]}
            ref={i === 0 ? ctl.elementRef : undefined}
            label={o.name}
            checked={ctl.isSelected(o)}
            disabled={locked || o.disabled}
            onChange={(_, d) => ctl.setSelected(o, !!d.checked)}
          />
        ))}
      </div>
    </Shell>,
  );
}

/** Fluent's `Select` is a native `<select>`: the string round-trip for free. */
function FluentSelect(p: SelectRenderProps): Rendered {
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
        ref={ctl.elementRef}
        id={p.id}
        className={mergeClass(undefined, p.className)}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        value={ctl.stringValue}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(_, d) => ctl.setFromString(d.value)}
        onBlur={ctl.onBlur}
      >
        <option value="" />
        {ctl.options.map((o, i) => (
          <option key={keys[i]} value={String(o.value)} disabled={o.disabled}>
            {o.name}
          </option>
        ))}
      </Select>
    </Shell>,
  );
}

function FluentRadio(p: RadioRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const entryCls = getProp(ctl.rc, p.entryClassName);
  const onCls = getProp(ctl.rc, p.selectedClassName);
  const offCls = getProp(ctl.rc, p.notSelectedClassName);
  const locked = ctl.state.disabled || ctl.state.readOnly;
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
      <RadioGroup
        name={p.id}
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={describedBy(p)}
        aria-invalid={p.error ? true : undefined}
        aria-required={p.required || undefined}
        value={ctl.stringValue}
        onChange={(_, d) => ctl.setFromString(d.value)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
      >
        {ctl.options.map((o, i) => {
          const selected = ctl.stringValue === String(o.value);
          return (
            <div key={keys[i]} className={entryClass(selected)}>
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
    </Shell>,
  );
}

/**
 * `TabList` is only the strip: the panels are ours, so every one stays
 * mounted without being told, and a hidden tab is simply left off the strip.
 * Fluent wires no `aria-controls`, so the tab ↔ panel ids are drawn here.
 */
function FluentTabs(p: TabsRenderProps) {
  const id = useId();
  const tabId = (key: string) => `${id}-tab-${key}`;
  const panelId = (key: string) => `${id}-panel-${key}`;
  return (
    <div className={mergeClass(undefined, p.className)} hidden={p.hidden || undefined}>
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

function FluentAction(p: ActionRenderProps) {
  const replace = p.iconPlacement === "replace";
  const icon = p.busy ? <Spinner size="extra-tiny" /> : p.icon;
  return (
    <DisplayShell shellClassName={p.shellClassName} inline={true} kind="action">
      <Button
        appearance={
          p.variant === "primary"
            ? "primary"
            : p.variant === "link"
              ? "transparent"
              : "secondary"
        }
        size="small"
        className={mergeClass(undefined, p.className)}
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
              <span className={mergeClass(undefined, p.textClassName)}>
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
function FluentContents(p: GroupRenderProps) {
  const top = (p.headingLevel ?? 2) <= 2;
  return (
    <ContentsRegion
      {...p}
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
  const { rc, rendered } = useReactive();
  const content = getProp(rc, p.text) ?? p.children;
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      style={toneStyle(p.tone)}
    >
      <Text
        className={mergeClass(undefined, p.className)}
        // Fluent's Text sets its own colour; inherit the shell's tone.
        style={p.tone ? { color: "inherit" } : undefined}
      >
        <span className={mergeClass(undefined, p.textClassName)}>
          {content}
        </span>
      </Text>
    </DisplayShell>,
  );
}

function FluentIcon(p: IconDisplayRenderProps) {
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
      style={toneStyle(p.tone)}
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
  const { rc, rendered } = useReactive();
  const html = getProp(rc, p.html);
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(html)}
      style={toneStyle(p.tone)}
    >
      <div
        className={mergeClass(
          undefined,
          combineClass(p.className, p.textClassName),
        )}
        style={{ ...typographyStyles.body1, ...(p.tone ? { color: "inherit" } : undefined) }}
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
  const shown = p.items.map((i, n) => ({ i, n })).filter(({ i }) => !i.hidden);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
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
              {step + 1}. {i.title}
            </Button>
          </li>
        ))}
      </ol>
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
      <div style={{ display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalM }}>
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
        className={mergeClass(undefined, p.className)}
        style={{
          border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
          borderRadius: tokens.borderRadiusLarge,
          padding: tokens.spacingHorizontalL,
        }}
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
        className={mergeClass(undefined, p.className)}
      >
        <DialogBody>
          {p.title && <DialogTitle>{p.title}</DialogTitle>}
          <DialogContent>{p.content}</DialogContent>
          <DialogActions>
            <Action
              actionId={StandardActionIds.close}
              text="Close"
              variant="secondary"
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
  action: FluentAction,
  contents: FluentContents,
  inline: Inline,
  wizard: FluentWizard,
  dialog: FluentDialog,
  tabs: FluentTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  form: FormElement,
  fieldShell: FluentFieldShell,
  inputFrame: FluentInputFrame,
  root: FluentRoot,
};
