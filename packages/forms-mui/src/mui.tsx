import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  type Ref,
} from "react";
import Checkbox from "@mui/material/Checkbox";
import { useTheme } from "@mui/material/styles";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiTabList from "@mui/material/Tabs";
import MuiTab from "@mui/material/Tab";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormGroup from "@mui/material/FormGroup";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import MuiTooltip from "@mui/material/Tooltip";
import MuiDialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import CssBaseline from "@mui/material/CssBaseline";
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
  type ControlSlotProps,
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
} from "@rx-controls/forms-html/shared";

/**
 * The one thing the library survey predicted would need a private channel: MUI's
 * `OutlinedInput` needs the label text a second time to cut the notch in its
 * own border, and the contract deliberately does not carry it. Shell and frame
 * always come from the same implementation, so the implementation owns this.
 */
const MuiLabelContext = createContext<ReactNode>(null);

function MuiFieldShell(p: FieldShellProps) {
  const legend = p.labelAs === "legend";
  const framed = p.surface === "frame";
  const hasLabel = p.label !== undefined && p.label !== null;
  return (
    <MuiLabelContext.Provider value={framed && !legend ? p.label : null}>
      <FormControl
        fullWidth
        error={!!p.error}
        required={p.required}
        disabled={p.disabled}
        className={mergeClass(undefined, p.className)}
      >
        {hasLabel && p.labelPosition === "after" ? (
          // MUI's trailing label is a component that wraps both.
          <FormControlLabel
            htmlFor={p.id}
            id={fieldLabelId(p.id)}
            label={
              <>
                {p.label}
                {p.required && <span aria-hidden="true"> *</span>}
              </>
            }
            disabled={p.disabled}
            control={<span className="mui-control-slot">{p.children}</span>}
          />
        ) : (
          <>
            {hasLabel &&
              (framed && !legend ? (
                <InputLabel
                  htmlFor={p.id}
                  id={fieldLabelId(p.id)}
                  className={mergeClass(
                    undefined,
                    combineClass(p.labelClassName, p.labelTextClassName),
                  )}
                >
                  {p.label}
                </InputLabel>
              ) : (
                <FormLabel
                  component={legend ? "div" : "label"}
                  id={fieldLabelId(p.id)}
                  htmlFor={legend ? undefined : p.id}
                  className={mergeClass(
                    undefined,
                    combineClass(p.labelClassName, p.labelTextClassName),
                  )}
                >
                  {p.label}
                </FormLabel>
              ))}
            {p.children}
          </>
        )}
        <RequiredNote
          id={p.id}
          required={p.required}
          describeRequired={p.describeRequired}
          text="Required"
        />
        {(p.error || p.helpText) && (
          <FormHelperText id={p.error ? fieldErrorId(p.id) : fieldHelpId(p.id)}>
            {p.error ?? p.helpText}
          </FormHelperText>
        )}
      </FormControl>
    </MuiLabelContext.Provider>
  );
}

/** One ref callback that feeds both: MUI's own on the control, and the widget's. */
function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): (el: T | null) => void {
  return (el) => {
    for (const r of refs) {
      if (typeof r === "function") r(el);
      else if (r) (r as { current: T | null }).current = el;
    }
  };
}

/**
 * Module-level and stable on purpose. MUI reaches the
 * control slot through `inputComponent`, i.e. a *component type*; an inline
 * component would change identity every render and remount the input on every
 * keystroke. The render function travels as data through `inputProps` instead.
 */
function MuiSlotBridge({
  __render,
  __state,
  __controlRef,
  value: _v,
  onChange: _c,
  defaultValue: _d,
  ownerState: _o,
  ...rest
}: Record<string, any>) {
  // MUI's own ref on the control, and the widget's — one stable callback, so
  // neither is detached and reattached on every render.
  const ref = useMemo(
    () => mergeRefs(rest.ref, __controlRef),
    [rest.ref, __controlRef],
  );
  return __render({ ...rest, ref } as ControlSlotProps, __state as FrameState);
}

function MuiInputFrame(p: InputFrameProps) {
  const label = useContext(MuiLabelContext);
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
        "aria-required": p.required || undefined,
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
    <OutlinedInput
      id={p.id}
      label={label}
      fullWidth
      error={p.invalid}
      disabled={p.disabled}
      readOnly={p.readOnly}
      multiline={p.multiline}
      aria-describedby={p.describedBy}
      className={mergeClass(undefined, p.className)}
      // The frame never sees a value, but `InputBase` drives the label's
      // shrink state from one. `filled` is the contract addition that makes
      // this expressible.
      value={p.filled ? " " : ""}
      startAdornment={
        p.start !== undefined ? (
          <InputAdornment position="start">{slot(p.start)}</InputAdornment>
        ) : undefined
      }
      endAdornment={
        p.end !== undefined ? (
          <InputAdornment position="end">{slot(p.end)}</InputAdornment>
        ) : undefined
      }
      inputComponent={MuiSlotBridge}
      inputProps={{ __render: render, __state: state, __controlRef: p.controlRef }}
    />
  );
}

function MuiTextField(p: TextFieldRenderProps): Rendered {
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
      widget="textfield"
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

/** MUI's own answer for a trailing label is a different component entirely. */
function MuiDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  if (p.inline)
    return ctl.rendered(
      <Typography
        id={p.id}
        component="span"
        variant="body2"
        className={mergeClass(undefined, p.className ?? p.textClassName)}
      >
        {ctl.content}
      </Typography>,
    );
  return ctl.rendered(
    <Shell
      widget="displayOnly"
      id={p.id}
      label={p.label}
      surface="custom"
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      error={p.error}
      className={p.shellClassName}
    >
      <Typography
        id={p.id}
        variant="body1"
        className={mergeClass(undefined, p.className ?? p.textClassName)}
        sx={p.noSelection ? { userSelect: "none" } : undefined}
      >
        {ctl.content}
      </Typography>
    </Shell>,
  );
}

function MuiCheckbox(p: CheckboxRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  return ctl.rendered(
    <Shell
      widget="checkbox"
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
        slotProps={{
          input: {
            ref: ctl.elementRef,
            "aria-describedby": describedBy(p),
            "aria-invalid": p.error ? true : undefined,
            "aria-required": p.required || undefined,
          },
        }}
        checked={ctl.checked}
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setChecked(e.target.checked)}
        onBlur={ctl.onBlur}
      />
    </Shell>,
  );
}

function MuiTabs(p: TabsRenderProps) {
  return (
    <Box sx={p.hidden ? { display: "none" } : undefined}>
      <MuiTabList
        value={p.activeKey}
        onChange={(_, v) => p.setActive(v as string)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
      >
        {/* A hidden tab stays a child, styled away: changing the children
            makes MUI re-measure the strip. */}
        {p.items.map((i) => (
          <MuiTab
            key={i.key}
            value={i.key}
            label={i.title}
            sx={{
              ...(i.invalid ? { color: "error.main" } : {}),
              ...(i.hidden ? { display: "none" } : {}),
            }}
          />
        ))}
      </MuiTabList>
      {/* MUI leaves panel rendering to the caller, which is exactly what
          `silent` needs — every panel mounted, the inactive ones drawing
          nothing of their own accord. */}
      {p.items.map((i) => (
        <Box key={i.key} sx={{ display: i.active ? undefined : "none" }}>
          {i.content}
        </Box>
      ))}
    </Box>
  );
}

function MuiAction(p: ActionRenderProps) {
  return (
    <DisplayShell shellClassName={p.shellClassName} inline={true} kind="action">
      <Button
        variant={
          p.variant === "primary"
            ? "contained"
            : p.variant === "link"
              ? "text"
              : "outlined"
        }
        size="small"
        className={mergeClass(undefined, p.className)}
        disabled={p.disabled}
        loading={p.busy}
        startIcon={
          (p.iconPlacement ?? "before") === "before" ? p.icon : undefined
        }
        endIcon={p.iconPlacement === "after" ? p.icon : undefined}
        type={p.submit ? "submit" : "button"}
        onClick={(e) => {
          if (p.submit) e.preventDefault();
          p.onClick();
        }}
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
    </DisplayShell>
  );
}

/** A tone's colour from the MUI palette, inherited by the text inside. */
/**
 * A titled group: the shared region, its title set in MUI's type scale. The
 * variant is chosen for a form section, not from the outline level — MUI's
 * `h2` is 60px — which is MUI's own convention: the variant for the look, the
 * element (here a `role="heading"` at the outline's level) for the meaning.
 */
function MuiContents(p: GroupRenderProps) {
  const t = useTheme();
  const top = (p.headingLevel ?? 2) <= 2;
  const type = top ? t.typography.h6 : t.typography.subtitle1;
  return (
    <ContentsRegion
      {...p}
      // The body's default layout: spacing is the container's, as under html,
      // so a display or a nested region is spaced like a field.
      layoutStyle={{
        display: "flex",
        flexDirection: "column",
        gap: t.spacing(1),
      }}
      titleStyle={{
        fontFamily: type.fontFamily,
        fontSize: type.fontSize,
        lineHeight: type.lineHeight,
        letterSpacing: type.letterSpacing,
        fontWeight: t.typography.fontWeightMedium,
        color: t.palette.text.primary,
        marginBottom: t.spacing(1),
      }}
    />
  );
}

function useToneStyle(tone: Tone | undefined): CSSProperties | undefined {
  const theme = useTheme();
  return tone ? { color: theme.palette[tone].main } : undefined;
}

function MuiText(p: TextDisplayRenderProps) {
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const content = getProp(rc, p.text) ?? p.children;
  return rendered(
    <DisplayShell
      shellClassName={p.shellClassName}
      inline={p.inline}
      tone={p.tone}
      announce={p.announce}
      regionOnly={p.regionOnly || noContent(content)}
      style={toneStyle}
    >
      <Typography
        variant="body2"
        component={p.inline ? "span" : "p"}
        className={mergeClass(undefined, p.className)}
      >
        <span className={mergeClass(undefined, p.textClassName)}>
          {content}
        </span>
      </Typography>
    </DisplayShell>,
  );
}

/** MUI makes the name visible through its own Tooltip — its call, not the contract's. */
function MuiIcon(p: IconDisplayRenderProps) {
  const toneStyle = useToneStyle(p.tone);
  const { rc, rendered } = useReactive();
  const glyph = (
    <Typography
      component="span"
      role="img"
      aria-label={p.accessibleName}
      className={mergeClass(
        undefined,
        combineClass(p.className, p.textClassName),
      )}
      sx={{ fontSize: 24, lineHeight: 1 }}
    >
      {getProp(rc, p.icon)}
    </Typography>
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
        <MuiTooltip title={p.accessibleName}>{glyph}</MuiTooltip>
      ) : (
        glyph
      )}
    </DisplayShell>,
  );
}

function MuiHtml(p: HtmlDisplayRenderProps) {
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
        variant="body2"
        component="div"
        className={mergeClass(
          undefined,
          combineClass(p.className, p.textClassName),
        )}
        dangerouslySetInnerHTML={{ __html: html ?? "" }}
      />
    </DisplayShell>,
  );
}

function MuiSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  return ctl.rendered(
    <Shell
      widget="select"
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
      {/* MUI's Select draws its own outlined input, so it takes the label
          text directly rather than going through the frame's context. */}
      <Select
        inputRef={ctl.elementRef}
        id={p.id}
        label={p.label}
        labelId={p.label != null ? fieldLabelId(p.id) : undefined}
        SelectDisplayProps={{ "aria-describedby": describedBy(p) }}
        value={ctl.stringValue}
        displayEmpty
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setFromString(String(e.target.value))}
        onBlur={ctl.onBlur}
      >
        {/* A required select with a value has no way back to empty. */}
        {(!p.required || ctl.stringValue === "") && (
          <MenuItem value="">
            <em>—</em>
          </MenuItem>
        )}
        {ctl.options.map((o, i) => (
          <MenuItem
            key={keys[i]}
            value={String(o.value)}
            disabled={o.disabled}
          >
            {o.name}
          </MenuItem>
        ))}
      </Select>
    </Shell>,
  );
}

function MuiRadio(p: RadioRenderProps): Rendered {
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
        onChange={(e) => ctl.setFromString(e.target.value)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
      >
        {entries.map(({ o, selected }, i) => (
          <Box key={keys[i]} className={entryClass(selected)}>
            <FormControlLabel
              value={String(o.value)}
              control={
                <Radio
                  slotProps={{ input: { ref: i === 0 ? ctl.elementRef : undefined } }}
                />
              }
              label={o.name}
              disabled={locked || o.disabled}
            />
            {p.children?.(o, selected)}
          </Box>
        ))}
      </RadioGroup>
    </Shell>,
  );
}

function MuiCheckList(p: CheckListRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const keys = optionKeys(ctl.options);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <Shell
      widget="checkList"
      id={p.id}
      label={p.label}
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
      <FormGroup
        role="group"
        aria-labelledby={p.label != null ? fieldLabelId(p.id) : undefined}
        aria-describedby={requiredDescribedBy(p)}
        onBlur={onFocusLeave(ctl.onBlur)}
        className={mergeClass(undefined, p.className)}
      >
        {ctl.options.map((o, i) => (
          <FormControlLabel
            key={keys[i]}
            control={
              <Checkbox
                slotProps={{
                  input: {
                    ref: i === 0 ? ctl.elementRef : undefined,
                    "aria-invalid": p.error ? true : undefined,
                  },
                }}
                checked={ctl.isSelected(o)}
                onChange={(e) => ctl.setSelected(o, e.target.checked)}
              />
            }
            label={o.name}
            disabled={locked || o.disabled}
          />
        ))}
      </FormGroup>
    </Shell>,
  );
}

function MuiWizard(p: WizardRenderProps) {
  const shown = p.items.filter((i) => !i.hidden);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      {/* The stepper counts the shown pages only. */}
      <Stepper
        activeStep={shown.findIndex((i) => i.key === p.items[p.index]?.key)}
        sx={{ mb: 2 }}
      >
        {shown.map((i) => (
          <Step key={i.key}>
            <StepLabel error={i.invalid}>{i.title}</StepLabel>
          </Step>
        ))}
      </Stepper>
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
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
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
      </Stack>
    </div>
  );
}

/** `keepMounted`: the closed dialog stays in the DOM, hidden — `silent` needs that. */
function MuiDialogImpl(p: DialogRenderProps) {
  if (p.inline)
    return (
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
        {p.title && <Typography variant="h6">{p.title}</Typography>}
        {p.content}
      </Box>
    );
  return (
    <MuiDialog open={p.open} onClose={p.onClose} keepMounted fullWidth>
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
    </MuiDialog>
  );
}

/**
 * The MUI implementation: every registry slot drawn with `@mui/material`.
 * Pass it to `FormProvider`; its `root` mounts MUI's `CssBaseline`, and an app
 * supplies its own `ThemeProvider` around it as usual.
 *
 * Three things it has to do that nothing else would make it: carry the label
 * a second time, privately, so the outlined frame can cut its notch; reach the
 * control slot through a stable `inputComponent`, or every keystroke remounts
 * the input; and keep a closed dialog mounted (`keepMounted`), which `silent`
 * needs.
 *
 * @group Rendering
 */
export const muiRenderers: FormRenderers = {
  name: "MUI",
  textfield: MuiTextField,
  checkbox: MuiCheckbox,
  displayOnly: MuiDisplayOnly,
  select: MuiSelect,
  radio: MuiRadio,
  checkList: MuiCheckList,
  text: MuiText,
  html: MuiHtml,
  icon: MuiIcon,
  action: MuiAction,
  contents: MuiContents,
  inline: Inline,
  wizard: MuiWizard,
  dialog: MuiDialogImpl,
  tabs: MuiTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  form: FormElement,
  fieldShell: MuiFieldShell,
  inputFrame: MuiInputFrame,
  root: ({ children }) => (
    <>
      <CssBaseline />
      {children}
    </>
  ),
};
