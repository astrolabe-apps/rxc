import {
  Children,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  type ImageSourcePropType,
  type TextStyle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  countText,
  describedBy,
  fieldCountId,
  fieldErrorId,
  fieldHelpId,
  fieldLabelId,
  fieldRequiredId,
  getProp,
  StandardActionIds,
  useCheckbox,
  useDisplayValue,
  useFieldShell,
  useInputFrame,
  useMultiSelectController,
  useSelectController,
  useTextInput,
  type ActionRenderProps,
  type CheckboxRenderProps,
  type CheckListRenderProps,
  type CollectionRenderProps,
  type DialogRenderProps,
  type DisclosureRenderProps,
  type DisplayOnlyRenderProps,
  type FieldOption,
  type FieldShellProps,
  type FormElementProps,
  type FormRenderers,
  type FrameState,
  type GroupRenderProps,
  type HtmlDisplayRenderProps,
  type IconDisplayRenderProps,
  type InputFrameProps,
  type RadioRenderProps,
  type SelectRenderProps,
  type TabsRenderProps,
  type TextDisplayRenderProps,
  type TextFieldRenderProps,
  type Tone,
  type WizardRenderProps,
  useFormLooks,
  warnUnknownLook,
  lookNames,
  type LookRef,
  NO_LOOK_STATE,
  type LookState,
  type PortableStyle,
  drawRichText,
  helpButtonName,
  plainText,
  richTextWords,
  type ImageDisplayRenderProps,
  type ImageFit,
  type RichTextRenderProps,
} from "@rx-controls/forms-react";
import { sp, type StylePiece, type StylePieces } from "./styleProps.js";
import { useNativeTheme, type NativeTheme } from "./theme.js";
import { resolvePart, type NativeLook, type NativeLookPartName, type ResolvedPart } from "./looks.js";

// ── Accessibility, for both of React Native's targets ────────────────
//
// Native React Native names a control by a string (`aria-label`; iOS has no
// `aria-labelledby`) and describes it by a string (`accessibilityHint`); it
// has no `aria-describedby`, `aria-required` or `aria-invalid`. The web
// (react-native-web) honours the `aria-*` props by id and drops the hint.
// An app on both targets needs both, so the implementation sets both and
// each platform ignores the other's.
//
// A state React Native turns into a native setter — `disabled`, `checked`,
// `selected`, `aria-disabled`, `editable` — is always a boolean, never
// `undefined`. Android calls the setter only for a key that is present, so
// `true` followed by `undefined` leaves the view disabled (or checked) for
// good; only an explicit `false` undoes it (the MAST alpha.7 trial's Q2).
// react-native-web has no such state, so the suites cannot catch a lapse:
// `test/disabledViews.test.tsx` pins the props instead.

/**
 * Props React Native's types do not declare, which react-native-web passes to
 * the DOM and native ignores: the web half of a control's description.
 */
function webOnly(props: Record<string, unknown>): object {
  return props;
}

declare const process: { env: { NODE_ENV?: string } } | undefined;
// The literal `process.env.NODE_ENV`, so bundlers fold it (see CLAUDE.md).
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const warnedClassLooks = new Set<string>();

/**
 * A boundary's look, resolved from the theme's `looks` — React Native
 * styles. Returns a function that resolves one part for the element's state
 * (with the window's width in it, for a look that is a function of it), with
 * the author's own `style` laid over it. A name the theme lacks draws the
 * base look and warns once: a name the *form* brought in `useFormLooks()` is
 * class-valued, which native does not draw, and says so.
 */
function useLook(kind: string, name: LookRef | undefined, fallback?: string) {
  const theme = useNativeTheme();
  const formLooks = useFormLooks();
  const { width } = useWindowDimensions();
  const layers: NativeLook[] = [];
  for (const n of lookNames(name)) {
    const found = theme.looks[n];
    if (found) layers.push(found);
    else if (n in formLooks) {
      if (IS_DEV && !warnedClassLooks.has(n)) {
        warnedClassLooks.add(n);
        console.warn(
          `Forms v2: look "${n}" is one of the form's own looks, which are class-valued; class looks are not drawn on native. Name "${n}" in the native theme's looks.`,
        );
      }
    } else warnUnknownLook(kind, n);
  }
  // Nothing named is known: draw the fallback, as an action does `secondary`.
  if (!layers.length && fallback !== undefined && lookNames(name).length)
    layers.push(theme.looks[fallback]);
  const part = (
    name: NativeLookPartName,
    state: LookState,
    authored?: PortableStyle,
    all?: boolean,
  ): ResolvedPart =>
    resolvePart(layers, name, { ...state, width }, theme.tokens.colors, authored, all);
  // The author's own `style`, resolved apart from the look's parts so it can
  // be laid over all of them: it wins over the look, whichever part a
  // property would have come from.
  part.own = (style: PortableStyle | undefined, all?: boolean): ResolvedPart =>
    resolvePart(undefined, "control", NO_LOOK_STATE, theme.tokens.colors, style, all);
  return part;
}

/** The slot's own styling, unless the look replaced it. */
const unless = <T,>(replaced: boolean, slot: T): T | undefined => (replaced ? undefined : slot);

/** Nothing to show: no node, or a node with no text in it. */
function empty(node: ReactNode): boolean {
  return node == null || node === false || (typeof node === "string" && node === "");
}

/**
 * A field's accessibility, both halves: native's name and hint as strings,
 * and the web's description by id. `count` joins the hint after the help or
 * error, as it joins the web's description.
 */
function fieldA11y(
  p: {
    id: string;
    label?: ReactNode;
    error?: ReactNode;
    helpText?: ReactNode;
    required?: boolean;
  },
  count?: ReactNode,
  /**
   * A group, which takes no `aria-required`: say "Required" first in its
   * description instead, as the shell's `describeRequired` note does.
   */
  requiredWords?: string,
) {
  const required = requiredWords !== undefined && p.required;
  const hint =
    [required && requiredWords, plainText(p.error ?? p.helpText), plainText(count)]
      .filter(Boolean)
      .join(". ") || undefined;
  const web = describedBy({ ...p, count });
  return {
    "aria-label": plainText(p.label) || undefined,
    accessibilityHint: hint,
    ...webOnly({
      "aria-describedby": required
        ? [fieldRequiredId(p.id), web].filter(Boolean).join(" ")
        : web,
      // A group takes no aria-invalid either: its checkboxes carry it.
      "aria-invalid": p.error && requiredWords === undefined ? true : undefined,
    }),
  };
}

/**
 * The form's submit, for the keyboard's submit key in a single-line field —
 * React Native's analogue of Enter in a web form's field.
 */
const SubmitContext = createContext<(() => void) | undefined>(undefined);

/**
 * Touched when focus leaves a group of options — the web's moment, through
 * react-native-web's focus events — but not when it moves between them.
 * Native never focuses an option; its widgets touch on press instead.
 */
function useLeaveGroup(onLeave: () => void) {
  const group = useRef<{ contains?(n: unknown): boolean } | null>(null);
  const onBlur = (e: { nativeEvent?: { relatedTarget?: unknown } }) => {
    const to = e?.nativeEvent?.relatedTarget;
    if (!to || !group.current?.contains?.(to)) onLeave();
  };
  return { group, onBlur };
}

// ── Shell and frame ───────────────────────────────────────────────────

type ShellTheme = NativeTheme["shell"];
/** Each theme's shell per widget, merged once. */
const shellsFor = new WeakMap<NativeTheme, Map<string, ShellTheme>>();

/** The shell slots for a widget: `shellFor[widget]` over `shell`. */
function shellOf(theme: NativeTheme, widget: string | undefined): ShellTheme {
  const over = widget === undefined ? undefined : theme.shellFor[widget];
  if (!over) return theme.shell;
  let cache = shellsFor.get(theme);
  if (!cache) shellsFor.set(theme, (cache = new Map()));
  let merged = cache.get(widget!);
  if (!merged) {
    merged = {
      ...theme.shell,
      ...(over as Partial<ShellTheme>),
      helpButton: {
        ...theme.shell.helpButton,
        ...(over.helpButton as Partial<ShellTheme["helpButton"]>),
      },
    };
    cache.set(widget!, merged);
  }
  return merged;
}

/**
 * What pressing the shell's label does: set by a widget whose label toggles
 * it, as a web `<label>` toggles its checkbox. Native has no such element, so
 * the label is pressable itself.
 */
const LabelPressContext = createContext<(() => void) | undefined>(undefined);

/**
 * The props of a checkbox's whole row as one accessible element, on a device:
 * set by a widget whose label sits beside its control. The row then carries
 * the role, name, state and press, so a touch anywhere on it (the words
 * included) lands on the control under explore-by-touch, as a web `<label>`
 * does for a pointer.
 */
const RowA11yContext = createContext<Record<string, unknown> | undefined>(undefined);

function NativeFieldShell(p: FieldShellProps) {
  const t = shellOf(useNativeTheme(), p.widget);
  const part = useLook("field", p.look);
  const lookState: LookState = { ...NO_LOOK_STATE, invalid: !empty(p.error), disabled: !!p.disabled };
  const shell = part("shell", lookState, p.style);
  const lookLabel = part("label", lookState);
  const lookLabelText = part("labelText", lookState, undefined, true);
  const onLabelPress = useContext(LabelPressContext);
  const row = useContext(RowA11yContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const hasLabel = p.label !== undefined && p.label !== null;
  const after = p.labelPosition === "after";
  const labelEnd = p.helpPlacement === "labelEnd" && !empty(p.helpText);
  // A group's question (a radio group's, a check list's) is the group's only
  // name on Android, which exposes none from the group's view: it stays in the
  // tree, as a stop before the options, read by `aria-label` to leave out the
  // required marker. Any other label is hidden: the control carries the name.
  const named = p.labelAs === "legend" && Platform.OS !== "web";
  const label = hasLabel && !p.hideLabel && (
    <Text
      id={fieldLabelId(p.id)}
      {...sp(unless(lookLabel.replace || lookLabelText.replace, t.label), lookLabel.box, lookLabel.text, lookLabelText.text)}
      {...(named
        ? {
            "aria-label": plainText(p.label) || undefined,
            accessibilityHint: p.required && p.describeRequired ? t.requiredNote : undefined,
          }
        : {
            // Native: the control carries the name, and a nested Text merges
            // into this one, so the marker would be read with it ("Name
            // star"). The web's aria-labelledby still names the control by
            // this element.
            importantForAccessibility: "no-hide-descendants",
            accessibilityElementsHidden: true,
          })}
      // A finger's target: for a widget whose label toggles it
      onPress={onLabelPress}
    >
      {p.label}
      {p.required && (
        <Text aria-hidden {...sp(t.required)}>
          {" *"}
        </Text>
      )}
    </Text>
  );
  // `labelEnd` help: a button beside the label. Its words, for every field,
  // are the theme's; what it describes is the field's own name.
  const helpButton = labelEnd && (
    <Pressable
      role="button"
      aria-label={helpButtonName(t.helpButton.text, p.label, p.helpLabel)}
      aria-expanded={helpOpen}
      onPress={() => setHelpOpen((o) => !o)}
      {...sp(t.helpButton.style)}
    >
      <Text aria-hidden>{t.helpButton.icon}</Text>
      {p.helpLabel != null && (
        <Text aria-hidden {...sp(t.helpButton.label)}>
          {p.helpLabel}
        </Text>
      )}
    </Pressable>
  );
  // The row of a label beside its control: on a device, one accessible
  // element when the widget asks (a help button inside stays its own stop)
  const rowOf = (style: object, kids: ReactNode) =>
    row ? (
      <Pressable {...row} {...sp(style)}>
        {kids}
      </Pressable>
    ) : (
      <View {...sp(style)}>{kids}</View>
    );
  return (
    <View {...sp(unless(shell.replace, t.style), shell.box)}>
      {after ? (
        // A trailing label: the control, its words, then any help button —
        // the order it is read in is the order it is seen in.
        rowOf(
          t.afterRow,
          <>
            {p.children}
            {label}
            {helpButton}
          </>,
        )
      ) : p.orientation === "horizontal" ? (
        // A leading label beside its control: the words, any help, then the
        // control at the row's end — read in the order it is seen.
        rowOf(
          t.horizontal,
          <>
            {label && helpButton ? (
              <View {...sp(t.labelRow)}>
                {label}
                {helpButton}
              </View>
            ) : (
              label || helpButton
            )}
            {p.children}
          </>,
        )
      ) : (
        <>
          {label && helpButton ? (
            <View {...sp(t.labelRow)}>
              {label}
              {helpButton}
            </View>
          ) : (
            label || helpButton
          )}
          {p.children}
        </>
      )}
      {labelEnd ? (
        // Kept under its id while closed: the web's description reads it.
        <Text
          id={fieldHelpId(p.id)}
          {...sp(t.help, !helpOpen && { display: "none" })}
        >
          {p.helpText}
        </Text>
      ) : (
        !empty(p.helpText) &&
        empty(p.error) && (
          <Text id={fieldHelpId(p.id)} {...sp(t.help)}>
            {p.helpText}
          </Text>
        )
      )}
      {p.required && p.describeRequired && (
        // Words for the web's description; native says it in the hint.
        <Text id={fieldRequiredId(p.id)} {...sp({ display: "none" })}>
          {t.requiredNote}
        </Text>
      )}
      {!empty(p.error) && (
        <Text id={fieldErrorId(p.id)} {...sp(t.error)}>
          {p.error}
        </Text>
      )}
      {p.count != null && (
        <Text id={fieldCountId(p.id)} {...sp(p.countOver ? t.countOver : t.count)}>
          {p.count}
        </Text>
      )}
    </View>
  );
}

function NativeInputFrame(p: InputFrameProps) {
  const t = useNativeTheme().frame;
  const [focused, setFocused] = useState(false);
  const state: FrameState = {
    focused,
    filled: !!p.filled,
    invalid: !!p.invalid,
    disabled: !!p.disabled,
    readOnly: !!p.readOnly,
    multiline: !!p.multiline,
  };
  const edge = (e: ReactNode | ((s: FrameState) => ReactNode)) =>
    typeof e === "function" ? e(state) : e;
  const part = useLook("field", p.look);
  const control = part("control", {
    ...NO_LOOK_STATE,
    focused,
    invalid: !!p.invalid,
    disabled: !!p.disabled,
  });
  const own = part.own(p.style);
  return (
    <View
      {...sp(
        unless(control.replace, [
          t.style,
          focused && t.focused,
          p.invalid && t.invalid,
          p.disabled && t.disabled,
        ]),
        control.box,
        own.box,
      )}
    >
      {/* An icon given as a string ("@") must be in a Text on native. */}
      {p.start !== undefined && wrapText(edge(p.start))}
      {p.render(
        {
          id: p.id,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          disabled: p.disabled,
          readOnly: p.readOnly,
          "aria-invalid": p.invalid || undefined,
          "aria-required": p.required || undefined,
          "aria-describedby": p.describedBy,
          ref: p.controlRef,
          // The theme's input, then the look's words for the control.
          ...sp(t.input, control.text),
        },
        state,
      )}
      {p.end !== undefined && wrapText(edge(p.end))}
    </View>
  );
}

// ── Fields ────────────────────────────────────────────────────────────

function NativeTextField(p: TextFieldRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useTextInput(p.field);
  const placeholder = getProp(ctl.rc, p.placeholder);
  const multiline = !!getProp(ctl.rc, p.multiline);
  const inputMode = getProp(ctl.rc, p.inputMode);
  const maxLength = getProp(ctl.rc, p.maxLength);
  const count = countText(ctl.value, getProp(ctl.rc, p.showCount), maxLength);
  const countOver = maxLength !== undefined && ctl.value.length > maxLength;
  const a11y = fieldA11y(p, count);
  const submit = useContext(SubmitContext);
  const lookPart = useLook("field", p.look);
  const textLook = lookPart(
    "text",
    { ...NO_LOOK_STATE, invalid: !!p.error, disabled: !!ctl.state.disabled },
    undefined,
    true,
  );
  const ownText = lookPart.own(p.style).text;
  return ctl.rendered(
    <Shell
      widget="textfield"
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
      count={count}
      countOver={countOver}
      look={p.look}
      style={p.shellStyle}
    >
      <Frame
        id={p.id}
        look={p.look}
        style={p.style}
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
        render={(slot) => (
          <TextInput
            id={slot.id}
            ref={slot.ref as never}
            {...sp(slot.style as object, textLook.text, ownText)}
            value={ctl.value}
            onChangeText={ctl.setValue}
            onFocus={() => (slot.onFocus as (() => void) | undefined)?.()}
            onBlur={() => {
              (slot.onBlur as (() => void) | undefined)?.();
              ctl.onBlur();
            }}
            // `editable` alone: React Native's `readOnly`, when given at all,
            // overrides it, so a disabled field would stay editable
            editable={!slot.disabled && !slot.readOnly}
            placeholder={placeholder}
            multiline={multiline}
            maxLength={maxLength}
            inputMode={inputMode}
            // The keyboard's submit key submits the form, as Enter does on
            // the web; a multi-line field takes it as a new line.
            onSubmitEditing={submit && !multiline ? submit : undefined}
            submitBehavior={submit && !multiline ? "blurAndSubmit" : undefined}
            {...a11y}
            // The label element by id where it is drawn: the web, and Android.
            aria-labelledby={
              a11y["aria-label"] !== undefined && !p.hideLabel ? fieldLabelId(p.id) : undefined
            }
            // Always a boolean: Android disables the view for `true`, and only
            // an explicit `false` enables it again once the field is
            aria-disabled={!!slot.disabled}
            {...webOnly({ "aria-required": slot["aria-required"] })}
          />
        )}
      />
    </Shell>,
  );
}

function NativeCheckbox(p: CheckboxRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  const t = useNativeTheme().checkbox;
  const part = useLook("field", p.look);
  const control = part("control", NO_LOOK_STATE, p.style);
  // A boolean, as every `disabled` handed to React Native: Android disables
  // the view for `true`, and only an explicit `false` enables it again.
  const locked = !!(ctl.state.disabled || ctl.state.readOnly);
  // Native has no focus to leave: a press is the touch.
  const toggle = (v: boolean) => {
    ctl.setChecked(v);
    ctl.onBlur();
  };
  const a11y = fieldA11y(p);
  // On a device the row is the one accessible element, its control hidden
  // from it (see `RowA11yContext`); a label that isn't drawn leaves the
  // control as it was
  const asRow = Platform.OS !== "web" && p.label != null && !p.hideLabel;
  const row: Record<string, unknown> | undefined = asRow
    ? {
        accessible: true,
        role: t.control === "switch" ? "switch" : "checkbox",
        "aria-label": a11y["aria-label"],
        "aria-checked": ctl.checked,
        accessibilityHint: a11y.accessibilityHint,
        accessibilityState: { checked: ctl.checked, disabled: locked },
        disabled: locked,
        onPress: () => toggle(!ctl.checked),
      }
    : undefined;
  const hidden = asRow ? ({ importantForAccessibility: "no-hide-descendants" } as const) : {};
  return ctl.rendered(
    <RowA11yContext.Provider value={row}>
    <LabelPressContext.Provider value={locked ? undefined : () => toggle(!ctl.checked)}>
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
      look={p.look}
      style={p.shellStyle}
    >
      {t.control === "switch" ? (
        <Switch
          id={p.id}
          ref={ctl.elementRef as never}
          value={ctl.checked}
          onValueChange={toggle}
          disabled={locked}
          trackColor={
            t.switchColors && { true: t.switchColors.trackOn, false: t.switchColors.trackOff }
          }
          thumbColor={ctl.checked ? t.switchColors?.thumbOn : t.switchColors?.thumbOff}
          ios_backgroundColor={t.switchColors?.trackOff}
          {...a11y}
          {...hidden}
          // React Native's Switch passes no `aria-label` to Android's view
          accessibilityLabel={a11y["aria-label"]}
          {...webOnly({ "aria-required": p.required || undefined })}
        />
      ) : (
        <Pressable
          id={p.id}
          ref={ctl.elementRef as never}
          role="checkbox"
          aria-checked={ctl.checked}
          disabled={locked}
          accessibilityState={{ checked: ctl.checked, disabled: locked }}
          onPress={() => toggle(!ctl.checked)}
          onBlur={ctl.onBlur}
          {...sp(unless(control.replace, [t.box, ctl.checked && t.checked]), control.box)}
          {...a11y}
          {...hidden}
          {...webOnly({ "aria-required": p.required || undefined })}
        >
          {ctl.checked && (
            <Text aria-hidden {...sp(t.mark)}>
              {t.markIcon}
            </Text>
          )}
        </Pressable>
      )}
    </Shell>
    </LabelPressContext.Provider>
    </RowA11yContext.Provider>,
  );
}

/**
 * A radio group: one ring per option, its per-option content under it,
 * selected or not — the content gates itself.
 */
function NativeRadio(p: RadioRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useSelectController(p.field, p.options);
  const t = useNativeTheme().radio;
  const part = useLook("field", p.look);
  const control = part("control", NO_LOOK_STATE, p.style);
  const words = part("text", NO_LOOK_STATE, undefined, true);
  const locked = !!(ctl.state.disabled || ctl.state.readOnly);
  const leave = useLeaveGroup(ctl.onBlur);
  const a11y = fieldA11y(p);
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
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <View
        ref={leave.group as never}
        role="radiogroup"
        {...sp(unless(control.replace, t.style), control.box)}
        {...a11y}
        aria-labelledby={p.label != null && !p.hideLabel ? fieldLabelId(p.id) : undefined}
        {...webOnly({ "aria-required": p.required || undefined })}
      >
        {ctl.options.map((o, i) => {
          const selected = ctl.stringValue === String(o.value);
          const entry = part("entry", NO_LOOK_STATE);
          const state = part(selected ? "selected" : "notSelected", NO_LOOK_STATE);
          return (
            <View
              key={`${i}:${String(o.value)}`}
              // A `{ replace }` drops what came before it: the theme's own entry
              // style, and the entry part for a replacing state.
              {...sp(
                !state.replace && !entry.replace && t.entry,
                !state.replace && entry.box,
                state.box,
              )}
            >
              <Pressable
                id={`${p.id}_${i}`}
                ref={i === 0 ? (ctl.elementRef as never) : undefined}
                role="radio"
                aria-checked={selected}
                aria-label={plainText(o.name)}
                disabled={locked || !!o.disabled}
                onPress={() => {
                  ctl.setFromString(String(o.value));
                  ctl.onBlur();
                }}
                onBlur={leave.onBlur as never}
                {...sp(t.option)}
              >
                <View {...sp(t.ring, selected && t.ringSelected)}>
                  {selected && <View {...sp(t.dot)} />}
                </View>
                <Text {...sp(t.label, control.text, words.text)}>{o.name}</Text>
              </Pressable>
              {p.children?.(o, selected)}
            </View>
          );
        })}
      </View>
    </Shell>,
  );
}

/** A set of checkboxes ticking values into an array, named as one group. */
function NativeCheckList(p: CheckListRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useMultiSelectController(p.field, p.options);
  const { checkList: t, checkbox: box, shell } = useNativeTheme();
  const part = useLook("field", p.look);
  const control = part("control", NO_LOOK_STATE, p.style);
  const words = part("text", NO_LOOK_STATE, undefined, true);
  const locked = !!(ctl.state.disabled || ctl.state.readOnly);
  const leave = useLeaveGroup(ctl.onBlur);
  const a11y = fieldA11y(p, undefined, shell.requiredNote);
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
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <View
        ref={leave.group as never}
        role="group"
        {...sp(unless(control.replace, t.style), control.box)}
        {...a11y}
        aria-labelledby={p.label != null && !p.hideLabel ? fieldLabelId(p.id) : undefined}
      >
        {ctl.options.map((o: FieldOption, i) => {
          const on = ctl.isSelected(o);
          return (
            <Pressable
              key={`${i}:${String(o.value)}`}
              id={`${p.id}_${i}`}
              ref={i === 0 ? (ctl.elementRef as never) : undefined}
              role="checkbox"
              aria-checked={on}
              aria-label={plainText(o.name)}
              disabled={locked || !!o.disabled}
              onPress={() => {
                ctl.setSelected(o, !on);
                ctl.onBlur();
              }}
              onBlur={leave.onBlur as never}
              {...sp(t.option)}
              {...webOnly({ "aria-invalid": p.error ? true : undefined })}
            >
              <View {...sp(box.box, on && box.checked)}>
                {on && (
                  <Text aria-hidden {...sp(box.mark)}>
                    {box.markIcon}
                  </Text>
                )}
              </View>
              <Text {...sp(t.label, control.text, words.text)}>{o.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </Shell>,
  );
}

/**
 * A select: a trigger in the input frame showing the chosen option, its
 * options in a sheet. The sheet holds no fields, so mounting it only while
 * open costs nothing.
 */
function NativeSelect(p: SelectRenderProps): Rendered {
  const Shell = useFieldShell();
  const Frame = useInputFrame();
  const ctl = useSelectController(p.field, p.options);
  const t = useNativeTheme().select;
  const words = useLook("field", p.look)("text", NO_LOOK_STATE, undefined, true);
  const [open, setOpen] = useState(false);
  const chosen = ctl.options.find((o) => String(o.value) === ctl.stringValue);
  const choices = [
    // A required select with a value has no way back to empty.
    ...(!p.required || ctl.stringValue === ""
      ? [{ key: "empty", value: "", name: t.emptyText as ReactNode, disabled: false }]
      : []),
    ...ctl.options.map((o, i) => ({
      key: `${i}:${String(o.value)}`,
      value: String(o.value),
      name: o.name as ReactNode,
      disabled: !!o.disabled,
    })),
  ];
  const close = () => {
    setOpen(false);
    ctl.onBlur();
  };
  const a11y = fieldA11y(p);
  return ctl.rendered(
    <Shell
      widget="select"
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
      look={p.look}
      style={p.shellStyle}
    >
      <Frame
        id={p.id}
        look={p.look}
        style={p.style}
        describedBy={describedBy(p)}
        controlRef={ctl.elementRef}
        invalid={!!p.error}
        required={p.required}
        disabled={ctl.state.disabled}
        readOnly={ctl.state.readOnly}
        filled={ctl.stringValue !== ""}
        start={p.startIcon}
        end={p.endIcon}
        render={(slot) => (
          <Pressable
            id={slot.id}
            ref={slot.ref as never}
            role="combobox"
            aria-expanded={open}
            disabled={!!(slot.disabled || slot.readOnly)}
            onPress={() => setOpen(true)}
            {...sp({ flex: 1 })}
            {...a11y}
            {...webOnly({ "aria-required": slot["aria-required"] })}
          >
            <Text {...sp(chosen ? t.value : t.placeholder, words.text)}>
              {chosen ? chosen.name : t.emptyText}
            </Text>
          </Pressable>
        )}
      />
      {open && (
        <Modal transparent visible animationType="slide" onRequestClose={close}>
          <Pressable {...sp(t.backdrop)} onPress={close} aria-label="Close">
            <View {...sp(t.sheet)}>
              <ScrollView role="list" aria-label={plainText(p.label) || undefined}>
                {choices.map((c) => {
                  const selected = c.value === ctl.stringValue;
                  return (
                    <Pressable
                      key={c.key}
                      role="option"
                      aria-selected={selected}
                      disabled={!!c.disabled}
                      onPress={() => {
                        ctl.setFromString(c.value);
                        close();
                      }}
                      {...sp(t.option, selected && t.optionSelected)}
                    >
                      <Text {...sp(t.optionText)}>{c.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      )}
    </Shell>,
  );
}

function NativeDisplayOnly(p: DisplayOnlyRenderProps): Rendered {
  const Shell = useFieldShell();
  const ctl = useDisplayValue(p.field, p);
  const t = useNativeTheme().displayOnly;
  const part = useLook("field", p.look);
  const control = part("control", NO_LOOK_STATE, p.style);
  const words = part("text", NO_LOOK_STATE, undefined, true);
  const start = p.startIcon != null && <View {...sp(t.icon)}>{wrapText(p.startIcon)}</View>;
  const end = p.endIcon != null && <View {...sp(t.icon)}>{wrapText(p.endIcon)}</View>;
  // Inline: the value in prose — no shell, no label.
  if (p.inline)
    return ctl.rendered(
      <Text id={p.id} {...sp(t.inline)}>
        {ctl.content}
      </Text>,
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
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <View
        id={p.id}
        {...sp(unless(control.replace, t.style), control.box)}
        {...webOnly({ "aria-describedby": describedBy(p) })}
      >
        {start}
        <Text {...sp(t.text, control.text, words.text)} selectable={!p.noSelection}>
          {ctl.content}
        </Text>
        {end}
      </View>
    </Shell>,
  );
}

// ── Groups, displays, actions ─────────────────────────────────────────

/**
 * A group's children, with any bare text wrapped: React Native draws text
 * only inside a `Text`, and an author writes `<Contents>words</Contents>` on
 * the web without a thought.
 */
function wrapText(children: ReactNode, ...style: (StylePiece | StylePieces)[]): ReactNode {
  return Children.map(children, (c) =>
    typeof c === "string" || typeof c === "number" ? (
      <Text {...sp(style)}>
        {c}
      </Text>
    ) : (
      c
    ),
  );
}

function NativeContents(p: GroupRenderProps) {
  const { contents: t, text } = useNativeTheme();
  const part = useLook("group", p.look);
  const st: LookState = { ...NO_LOOK_STATE, invalid: !!p.invalid };
  const shell = part("shell", st, p.shellStyle);
  const body = part("control", st);
  const ownBody = part.own(p.style);
  const words = part("text", st, undefined, true);
  const title = part("label", st);
  const titleText = part("labelText", st, undefined, true);
  return (
    // Hiding is a style: it works with no theme at all.
    <View
      {...sp(unless(shell.replace, t.wrapper), shell.box, p.hidden && { display: "none" })}
    >
      {p.title !== undefined && p.title !== null && (
        <Text
          role="heading"
          aria-level={p.headingLevel}
          {...sp(unless(title.replace || titleText.replace, t.title), title.box, title.text, titleText.text)}
        >
          {p.title}
        </Text>
      )}
      <View {...sp(unless(body.replace, t.body), body.box, ownBody.box)}>
        {wrapText(p.children, text.style, body.text, words.text, ownBody.text)}
      </View>
    </View>
  );
}

function NativeInline(p: GroupRenderProps) {
  const { inline: t, text } = useNativeTheme();
  const part = useLook("group", p.look);
  const shell = part("shell", NO_LOOK_STATE, p.shellStyle);
  const control = part("control", NO_LOOK_STATE);
  const own = part.own(p.style);
  const words = part("text", NO_LOOK_STATE, undefined, true);
  return (
    // One element: the look's shell and control both land on it. A `Text`,
    // not a `View`: an inline group is prose, and only text nested in text
    // flows — each child of a row of views is a block of its own, so a long
    // sentence filled the row and pushed its link onto a line by itself.
    <Text
      {...sp(
        unless(shell.replace || control.replace, t.wrapper),
        text.style,
        control.text,
        words.text,
        own.text,
        shell.box as TextStyle,
        control.box as TextStyle,
        own.box as TextStyle,
        p.hidden && { display: "none" },
      )}
    >
      {p.children}
    </Text>
  );
}

/**
 * The live region a display announces in: `role="alert"` for an error,
 * `status` otherwise, and Android's own live region beside it.
 */
function liveRegion(announce: boolean, tone: Tone | undefined) {
  if (!announce) return {};
  const urgent = tone === "error";
  return {
    role: urgent ? ("alert" as const) : ("status" as never),
    accessibilityLiveRegion: urgent ? ("assertive" as const) : ("polite" as const),
  };
}

function NativeText(p: TextDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const t = useNativeTheme().text;
  const content = getProp(rc, p.text) ?? p.children;
  const heading = !p.inline && !!getProp(rc, p.heading);
  const lookPart = useLook("text", p.look);
  const st: LookState = { ...NO_LOOK_STATE };
  const shell = lookPart("shell", st, p.shellStyle);
  const control = lookPart("control", st, undefined, true);
  const words = lookPart("text", st, undefined, true);
  const ownText = lookPart.own(p.style, true);
  const live = liveRegion(p.announce, p.tone);
  // An announced display hidden, or with nothing to say, keeps only its
  // live region — the same element, so content arriving in it is announced.
  if (p.regionOnly || (p.announce && plainText(content) === ""))
    return rendered(<View {...live} />);
  const text = (
    <Text
      {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
      aria-label={p.accessibleName}
      {...sp(
        unless(control.replace || words.replace, [
          heading
            ? [
                t.heading.style,
                t.heading.levels[Math.min(Math.max(p.headingLevel, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6],
              ]
            : t.style,
        ]),
        control.text,
        words.text,
        p.tone && !(control.replace || words.replace) && t.tones[p.tone],
        ownText.text,
      )}
    >
      {content}
    </Text>
  );
  // Inline in prose: the text alone.
  if (p.inline && !p.announce) return rendered(text);
  return rendered(
    <View {...live} {...sp(shell.box)}>
      {text}
    </View>,
  );
}

function NativeIcon(p: IconDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const { icon: t, text } = useNativeTheme();
  const lookPart = useLook("icon", p.look);
  const control = lookPart("control", NO_LOOK_STATE, undefined, true);
  const words = lookPart("text", NO_LOOK_STATE, undefined, true);
  const shell = lookPart("shell", NO_LOOK_STATE, p.shellStyle);
  const ownText = lookPart.own(p.style, true);
  const live = liveRegion(p.announce, p.tone);
  if (p.regionOnly) return rendered(<View {...live} />);
  const glyph = getProp(rc, p.icon);
  // On the view and on a glyph's Text alike, as the base is: a size or a
  // colour reaches a string glyph only on its Text.
  const look = [t.style, control.text, words.text, p.tone && text.tones[p.tone], ownText.text];
  return rendered(
    <View
      {...live}
      role="img"
      aria-label={p.accessibleName}
      {...sp(look, shell.box)}
    >
      {typeof glyph === "string" ? (
        <Text {...sp(look)}>
          {glyph}
        </Text>
      ) : (
        glyph
      )}
    </View>,
  );
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Markup's text: tags dropped, block ends as line breaks, entities decoded. */
function htmlText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
      e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : (entities[e.toLowerCase()] ?? m),
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The html display: its markup's text. React Native has no HTML; an app that
 * needs it rendered (links, lists, emphasis) replaces this slot with one over
 * a renderer of its choosing, such as react-native-render-html.
 */
function NativeHtml(p: HtmlDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const { html: t, text } = useNativeTheme();
  const html = getProp(rc, p.html) ?? "";
  const live = liveRegion(p.announce, p.tone);
  if (p.regionOnly || (p.announce && html === "")) return rendered(<View {...live} />);
  return rendered(
    <View {...live}>
      <Text {...sp(t.style, p.tone && text.tones[p.tone])}>
        {htmlText(html)}
      </Text>
    </View>,
  );
}

/** A source as React Native's `Image` takes it. */
function nativeSource(source: unknown): ImageSourcePropType | undefined {
  if (typeof source === "string") return { uri: source };
  if (typeof source === "number") return source;
  if (source && typeof source === "object") {
    const o = source as { uri?: unknown; src?: unknown };
    if (typeof o.uri === "string") return source as ImageSourcePropType;
    // A web bundler's static import, on the web half.
    if (typeof o.src === "string") return { uri: o.src };
  }
  return undefined;
}

type Dimension = number | `${number}%`;

/**
 * An image with a size. React Native draws none without one, so a missing
 * dimension comes from the image's own proportions: read from a bundled
 * asset at once, or from the file once it loads.
 */
function SizedImage({
  source,
  alt,
  width,
  height,
  fit,
  style,
}: {
  source: ImageSourcePropType;
  alt: string;
  width?: Dimension;
  height?: Dimension;
  fit?: ImageFit;
  /** The theme's, the look's and the author's styles, applied after the image's own sizing. */
  style?: StylePieces;
}) {
  const uri = typeof source === "object" && !Array.isArray(source) ? source.uri : undefined;
  const bundled =
    typeof source === "number" ? Image.resolveAssetSource?.(source) : undefined;
  const [loaded, setLoaded] = useState<{ width: number; height: number }>();
  const sized = width !== undefined && height !== undefined;
  useEffect(() => {
    if (sized || !uri) return;
    let live = true;
    Image.getSize(
      uri,
      (w, h) => live && setLoaded({ width: w, height: h }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [uri, sized]);
  const natural = bundled ?? loaded;
  const ratio = natural && natural.height > 0 ? natural.width / natural.height : undefined;
  return (
    <Image
      source={source}
      alt={alt}
      aria-label={alt || undefined}
      // `alt=""` decorates: out of the accessibility tree, as the web's is.
      accessible={alt !== ""}
      aria-hidden={alt === "" || undefined}
      accessibilityIgnoresInvertColors
      resizeMode={fit === "fill" ? "stretch" : (fit ?? "contain")}
      {...sp(
        {
          width: width ?? (height === undefined ? natural?.width : undefined) ?? 0,
          ...(height !== undefined
            ? { height }
            : ratio !== undefined
              ? // `auto` over the height React Native's Image puts in its base
                // style for a sized source, which would win over the ratio
                { aspectRatio: ratio, height: "auto" as const }
              : { height: 0 }),
        },
        style,
      )}
    />
  );
}

function NativeImage(p: ImageDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const t = useNativeTheme().image;
  const source = nativeSource(getProp(rc, p.source));
  const lookPart = useLook("image", p.look);
  const shell = lookPart("shell", NO_LOOK_STATE, p.shellStyle);
  const control = lookPart("control", NO_LOOK_STATE);
  const own = lookPart.own(p.style);
  const live = liveRegion(p.announce, p.tone);
  if (p.regionOnly || !source) return rendered(<View {...live} />);
  return rendered(
    <View {...live} {...sp(shell.box)}>
      <SizedImage
        source={source}
        alt={getProp(rc, p.alt) ?? ""}
        width={getProp(rc, p.width)}
        height={getProp(rc, p.height)}
        fit={getProp(rc, p.fit)}
        style={[t.style, control.box, own.box]}
      />
    </View>,
  );
}

const SUPER: Record<string, string> = {
  "0": "\u2070", "1": "\u00b9", "2": "\u00b2", "3": "\u00b3", "4": "\u2074",
  "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079",
  "+": "\u207a", "-": "\u207b", "=": "\u207c", "(": "\u207d", ")": "\u207e",
};
const SUB: Record<string, string> = {
  "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084",
  "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089",
  "+": "\u208a", "-": "\u208b", "=": "\u208c", "(": "\u208d", ")": "\u208e",
};

/**
 * A raised or lowered run's words as the Unicode characters that are raised
 * or lowered in every font — `m³`, `H₂O` — when each has one. Nested `Text`
 * has no baseline shift, so this is what draws a superscript as one.
 */
function shifted(words: string, map: Record<string, string>): string | undefined {
  let out = "";
  for (const c of words) {
    const m = map[c];
    if (m === undefined) return undefined;
    out += m;
  }
  return out || undefined;
}

/**
 * Rich text as nested `Text`, which inherits what it sits in: emphasis by
 * style, a link pressed open through `Linking`, a break a newline.
 */
function NativeRichText({ nodes }: RichTextRenderProps) {
  const t = useNativeTheme().richText;
  return (
    <Text>
      {drawRichText(nodes, {
        strong: (ch, k) => (
          <Text key={k} {...sp(t.strong)}>
            {ch}
          </Text>
        ),
        em: (ch, k) => (
          <Text key={k} {...sp(t.em)}>
            {ch}
          </Text>
        ),
        sup: (ch, k, n) => (
          <Text key={k} {...sp(t.sup)}>
            {shifted(richTextWords(n.children), SUPER) ?? ch}
          </Text>
        ),
        sub: (ch, k, n) => (
          <Text key={k} {...sp(t.sub)}>
            {shifted(richTextWords(n.children), SUB) ?? ch}
          </Text>
        ),
        link: (n, ch, k) => (
          <Text
            key={k}
            role="link"
            {...sp(t.link)}
            onPress={() => void Linking.openURL(n.href)}
            {...webOnly({ href: n.href, hrefAttrs: n.target ? { target: n.target, rel: "noopener noreferrer" } : undefined })}
          >
            {ch}
          </Text>
        ),
        break: (k) => <Text key={k}>{"\n"}</Text>,
        image: (n, k) => (
          <SizedImage
            key={k}
            source={{ uri: n.src }}
            alt={n.alt}
            width={n.width}
            height={n.height}
            style={[t.image]}
          />
        ),
      })}
    </Text>
  );
}

function NativeAction(p: ActionRenderProps) {
  const t = useNativeTheme().action;
  const [pressed, setPressed] = useState(false);
  // A role the theme does not name draws as the default emphasis.
  const lookPart = useLook("action", p.look, "secondary");
  const st: LookState = { ...NO_LOOK_STATE, disabled: !!p.disabled, pressed };
  const shell = lookPart("shell", st, p.shellStyle);
  const control = lookPart("control", st);
  const own = lookPart.own(p.style);
  const words = lookPart("text", st, undefined, true);
  const wordStyle = [control.text, words.text, own.text];
  const iconPart = lookPart("icon", st);
  // The spinner is decoration: on Android a spinner inside a button gave the
  // button its own "busy" description, which then outlived the spinner and
  // replaced the button's name. The busy state says it.
  const shown = p.busy ? (
    <ActivityIndicator
      size="small"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  ) : (
    p.icon
  );
  const textStyle = [t.textStyle, wordStyle];
  // A glyph is drawn in the text's look, since React Native text inherits
  // nothing from the button: that is how it takes the button's colour.
  const icon = shown != null && shown !== false && (
    <View {...sp(t.iconStyle, iconPart.box)}>
      {wrapText(shown, textStyle, t.iconTextStyle)}
    </View>
  );
  const button = (
    <Pressable
      role="button"
      disabled={p.disabled}
      accessibilityState={{ busy: !!p.busy, disabled: !!p.disabled }}
      aria-label={plainText(p.children ?? p.text) || undefined}
      onPress={() => p.onClick()}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      {...sp(
        unless(control.replace, [t.style, p.disabled && t.disabled]),
        control.box,
        own.box,
      )}
    >
      {p.iconPlacement !== "after" && icon}
      {p.iconPlacement !== "replace" &&
        (p.children ?? (
          <Text {...sp(textStyle)}>
            {p.text}
          </Text>
        ))}
      {p.iconPlacement === "after" && icon}
    </Pressable>
  );
  // The wrapper exists only when a look or the author styles it.
  return shell.box ? <View {...sp(shell.box)}>{button}</View> : button;
}

// ── Containers ────────────────────────────────────────────────────────

/** Every panel, always, the inactive ones hidden — an unmounted one validates nothing. */
function NativeTabs(p: TabsRenderProps) {
  const t = useNativeTheme().tabs;
  const base = useId();
  const tabId = (key: string) => `${base}-tab-${key}`;
  const panelId = (key: string) => `${base}-panel-${key}`;
  return (
    <View {...sp(t.style, p.hidden && { display: "none" })}>
      <View role="tablist" {...sp(t.list)}>
        {p.items
          .filter((i) => !i.hidden)
          .map((i) => (
            <Pressable
              key={i.key}
              id={tabId(i.key)}
              role="tab"
              aria-selected={i.active}
              onPress={() => p.setActive(i.key)}
              {...sp(t.tab, i.active ? t.active : t.inactive)}
              {...webOnly({ "aria-controls": panelId(i.key) })}
            >
              <Text {...sp(t.tabText, i.active && t.activeText)}>{i.title}</Text>
              {i.invalid && (
                <Text aria-hidden {...sp(t.invalidMarker)}>
                  {"●"}
                </Text>
              )}
            </Pressable>
          ))}
      </View>
      {p.items.map((i) => (
        <View
          key={i.key}
          id={panelId(i.key)}
          role="tabpanel"
          {...sp(t.panel, !i.active && { display: "none" })}
          {...webOnly({ "aria-labelledby": i.hidden ? undefined : tabId(i.key) })}
        >
          {i.content}
        </View>
      ))}
    </View>
  );
}

function NativeWizard(p: WizardRenderProps) {
  const t = useNativeTheme().wizard;
  // `none`: the pages only — the host's own actions move the wizard.
  const nav = p.navigation === "builtin";
  return (
    <View {...sp(p.hidden && { display: "none" })}>
      {nav && (
        <View {...sp(t.steps)}>
          {/* Steps over the shown pages only, numbered among themselves. */}
          {p.items
            .map((i, n) => ({ i, n }))
            .filter(({ i }) => !i.hidden)
            .map(({ i, n }, step) => (
              <Pressable
                key={i.key}
                role="button"
                aria-current={n === p.index ? "step" : undefined}
                onPress={() => p.goTo(n)}
                {...sp(t.step, n === p.index && t.active)}
              >
                <Text {...sp(t.stepText)}>
                  {step + 1}{i.title != null && <>. {i.title}</>}
                </Text>
              </Pressable>
            ))}
        </View>
      )}
      {/* Every page rendered: an unreached one is `silent`, not absent. */}
      {p.items.map((i) => (
        <View
          key={i.key}
          {...sp(t.page, !i.active && { display: "none" })}
        >
          {i.content}
        </View>
      ))}
      {nav && (
        <View {...sp(t.nav)}>
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
        </View>
      )}
    </View>
  );
}

/**
 * React Native's Modal mounts its content only while visible, and no portal
 * keeps a node across a move, so the contract's "one parent that never
 * changes" cannot hold here: closed, the content is mounted in place and
 * hidden — still validating, never cleared — and open, it is in the Modal.
 * The data survives the move (it lives in controls); a widget's own state,
 * such as focus, does not.
 */
function NativeDialog(p: DialogRenderProps) {
  const t = useNativeTheme().dialog;
  if (p.inline)
    return (
      <View {...sp(t.inline)}>
        {p.title != null && <Text {...sp(t.title)}>{p.title}</Text>}
        {p.content}
      </View>
    );
  if (!p.open)
    return (
      <View
        {...sp({ display: "none" })}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {p.content}
      </View>
    );
  return (
    <Modal transparent visible animationType="fade" onRequestClose={p.onClose}>
      <View {...sp(t.backdrop, p.hidden && { display: "none" })}>
        <View role="dialog" aria-modal {...sp(t.surface)}>
          {p.title != null && (
            <Text role="heading" {...sp(t.title)}>
              {p.title}
            </Text>
          )}
          {p.content}
          <View {...sp(t.actions)}>
            <Action
              actionId={StandardActionIds.close}
              text="Close"
              look="secondary"
              onClick={p.onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A toggle and its content; closed, the content is mounted and hidden. */
function NativeDisclosure(p: DisclosureRenderProps) {
  const t = useNativeTheme().disclosure;
  const part = useLook("disclosure", p.look);
  const st: LookState = { ...NO_LOOK_STATE, invalid: !!p.invalid };
  const shell = part("shell", st, p.style);
  const toggle = part("control", st);
  const icon = (
    <View aria-hidden {...sp(p.open && { transform: [{ rotate: "90deg" }] })}>
      <Text {...sp(t.title, t.iconStyle)}>{t.icon}</Text>
    </View>
  );
  return (
    <View {...sp(unless(shell.replace, t.style), shell.box, p.hidden && { display: "none" })}>
      <Pressable
        role="button"
        aria-expanded={p.open}
        onPress={() => p.setOpen(!p.open)}
        {...sp(unless(toggle.replace, t.toggle), toggle.box)}
        {...webOnly({ "aria-controls": p.id })}
      >
        {t.iconPlacement !== "after" && icon}
        <Text {...sp(t.title)}>{p.title}</Text>
        {t.iconPlacement === "after" && icon}
        {p.invalid && (
          <Text aria-hidden {...sp(t.invalidMarker)}>
            {"●"}
          </Text>
        )}
      </Pressable>
      <View id={p.id} {...sp(t.content, !p.open && { display: "none" })}>
        {p.content}
      </View>
    </View>
  );
}

/** The chrome-less collection: the shell, around rows the boundary built. */
function NativeElements(p: CollectionRenderProps<unknown>) {
  const Shell = useFieldShell();
  const t = useNativeTheme().elements;
  return (
    <Shell
      widget="elements"
      id={p.id}
      label={p.label}
      labelAs="legend"
      surface="custom"
      required={p.required}
      helpText={p.helpText}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <View {...sp(t.style)}>
        {p.elements.length ? p.elements.map((e) => <View key={e.key}>{e.node}</View>) : p.empty}
      </View>
    </Shell>
  );
}

/**
 * React Native has no form element: submission is the submit action's, and
 * the keyboard's submit key in a single-line field.
 */
function NativeForm(p: FormElementProps) {
  return (
    <SubmitContext.Provider value={p.onSubmit}>
      <View>{p.children}</View>
    </SubmitContext.Provider>
  );
}

/**
 * The React Native implementation: every registry slot, drawn with React
 * Native's own components and styled through {@link NativeTheme} (React Native
 * styles, handed to each element through `styleProps.ts`). Pass it to
 * `FormProvider`.
 *
 * Behaviour never depends on the theme: hidden regions, inactive tabs and
 * wizard pages, closed disclosures and closed dialogs are off screen by
 * style, with no stylesheet at all.
 *
 * @group Rendering
 */
export const nativeRenderers: FormRenderers = {
  name: "native",
  textfield: NativeTextField,
  checkbox: NativeCheckbox,
  select: NativeSelect,
  radio: NativeRadio,
  checkList: NativeCheckList,
  displayOnly: NativeDisplayOnly,
  action: NativeAction,
  text: NativeText,
  html: NativeHtml,
  icon: NativeIcon,
  richText: NativeRichText,
  image: NativeImage,
  contents: NativeContents,
  inline: NativeInline,
  tabs: NativeTabs,
  wizard: NativeWizard,
  dialog: NativeDialog,
  disclosure: NativeDisclosure,
  elements: NativeElements,
  fieldShell: NativeFieldShell,
  inputFrame: NativeInputFrame,
  visibility: ({ visible, children }) => (visible ? <>{children}</> : null),
  form: NativeForm,
};
