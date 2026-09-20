import {
  createContext,
  useContext,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import Checkbox from "@mui/material/Checkbox";
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
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Typography from "@mui/material/Typography";
import CssBaseline from "@mui/material/CssBaseline";
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
  type ControlSlotProps,
  type ActionRenderProps,
  type HtmlDisplayRenderProps,
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
import { Contents, ElementsList, DefaultVisibility } from "./shared.js";

/**
 * The one thing §7's survey predicted would need a private channel: MUI's
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
    <MuiLabelContext value={framed && !legend ? p.label : null}>
      <FormControl
        fullWidth
        error={!!p.error}
        required={p.required}
        disabled={p.disabled}
        component={legend ? "fieldset" : "div"}
        className={mergeClass(undefined, p.className)}
        sx={{ mb: 1 }}
      >
        {hasLabel && p.labelPosition === "after" ? (
          // MUI's trailing label is a component that wraps both.
          <FormControlLabel
            htmlFor={p.id}
            label={
              <>
                {p.label}
                {p.required && " *"}
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
                  className={mergeClass(undefined, p.labelClassName)}
                >
                  {p.label}
                </InputLabel>
              ) : (
                <FormLabel
                  component={legend ? "legend" : "label"}
                  htmlFor={legend ? undefined : p.id}
                  className={mergeClass(undefined, p.labelClassName)}
                >
                  {p.label}
                </FormLabel>
              ))}
            {p.children}
          </>
        )}
        {(p.error || p.helpText) && (
          <FormHelperText id={p.error ? `${p.id}-error` : `${p.id}-help`}>
            {p.error ?? p.helpText}
          </FormHelperText>
        )}
      </FormControl>
    </MuiLabelContext>
  );
}

/**
 * Module-level and stable on purpose (README finding 10). MUI reaches the
 * control slot through `inputComponent`, i.e. a *component type*; an inline
 * component would change identity every render and remount the input on every
 * keystroke. The render function travels as data through `inputProps` instead.
 */
function MuiSlotBridge({
  __render,
  __state,
  value: _v,
  onChange: _c,
  defaultValue: _d,
  ownerState: _o,
  ...rest
}: Record<string, any>) {
  return __render(rest as ControlSlotProps, __state as FrameState);
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
      // this expressible — see README finding 3.
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
      inputProps={{ __render: render, __state: state }}
    />
  );
}

function MuiTextField(p: TextFieldRenderProps): Rendered {
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

/** MUI's own answer for a trailing label is a different component entirely. */
function MuiCheckbox(p: CheckboxRenderProps): Rendered {
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

function MuiStack(p: StackProps) {
  const { rc, rendered } = useReactive();
  return rendered(
    <Stack
      direction={getProp(rc, p.direction) === "row" ? "row" : "column"}
      sx={{
        gap: `${getProp(rc, p.gap) ?? 16}px`,
        justifyContent: getProp(rc, p.justify),
        alignItems: getProp(rc, p.align),
        flexWrap: getProp(rc, p.wrap) ? "wrap" : undefined,
      }}
      className={mergeClass(undefined, getProp(rc, p.className))}
    >
      {p.children}
    </Stack>,
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
        {p.items.map((i) => (
          <MuiTab
            key={i.key}
            value={i.key}
            label={i.title}
            sx={i.invalid ? { color: "error.main" } : undefined}
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
    <Button
      variant={
        p.style === "primary"
          ? "contained"
          : p.style === "link"
            ? "text"
            : "outlined"
      }
      size="small"
      disabled={p.disabled}
      loading={p.busy}
      startIcon={p.icon}
      onClick={p.onClick}
    >
      {p.children ?? p.text}
    </Button>
  );
}

function MuiText(p: TextDisplayRenderProps) {
  return (
    <Typography
      variant="body2"
      className={mergeClass(undefined, p.className ?? p.textClassName)}
    >
      {p.text ?? p.children}
    </Typography>
  );
}

function MuiHtml(p: HtmlDisplayRenderProps) {
  return (
    <Typography
      variant="body2"
      component="div"
      className={mergeClass(undefined, p.className)}
      dangerouslySetInnerHTML={{ __html: p.html ?? "" }}
    />
  );
}

function MuiSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
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
    >
      {/* MUI's Select draws its own outlined input, so it takes the label
          text directly rather than going through the frame's context. */}
      <Select
        id={p.id}
        label={p.label}
        value={ctl.stringValue}
        displayEmpty
        disabled={ctl.state.disabled || ctl.state.readOnly}
        onChange={(e) => ctl.setFromString(String(e.target.value))}
        onBlur={ctl.onBlur}
      >
        <MenuItem value="">
          <em>—</em>
        </MenuItem>
        {ctl.options.map((o) => (
          <MenuItem key={o.value} value={String(o.value)} disabled={o.disabled}>
            {o.name}
          </MenuItem>
        ))}
      </Select>
    </Shell>,
  );
}

function MuiWizard(p: WizardRenderProps) {
  const NextBtn = useAction(StandardActionIds.next);
  const BackBtn = useAction(StandardActionIds.back);
  return (
    <div style={p.hidden ? { display: "none" } : undefined}>
      <Stepper activeStep={p.index} sx={{ mb: 2 }}>
        {p.items.map((i) => (
          <Step key={i.key}>
            <StepLabel error={i.invalid && i.visited}>{i.title}</StepLabel>
          </Step>
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

export const muiRenderers: FormRenderers = {
  name: "MUI",
  textfield: MuiTextField,
  checkbox: MuiCheckbox,
  select: MuiSelect,
  text: MuiText,
  html: MuiHtml,
  action: MuiAction,
  contents: Contents,
  wizard: MuiWizard,
  tabs: MuiTabs,
  elements: ElementsList,
  visibility: DefaultVisibility,
  fieldShell: MuiFieldShell,
  inputFrame: MuiInputFrame,
  stack: MuiStack,
  root: ({ children }) => (
    <>
      <CssBaseline />
      {children}
    </>
  ),
};
