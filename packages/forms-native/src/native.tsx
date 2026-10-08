import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
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
  type ClassValue,
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
} from "@rx-controls/forms-react";
import { twMerge } from "tailwind-merge";
import { useNativeTheme } from "./theme.js";

// ── Accessibility, for both of React Native's targets ────────────────
//
// Native React Native names a control by a string (`aria-label`; iOS has no
// `aria-labelledby`) and describes it by a string (`accessibilityHint`); it
// has no `aria-describedby`, `aria-required` or `aria-invalid`. The web
// (react-native-web) honours the `aria-*` props by id and drops the hint.
// An app on both targets needs both, so the implementation sets both and
// each platform ignores the other's.

/** The plain text of a node — what a native name or hint can carry. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node))
    return Children.toArray(
      (node as ReactElement<{ children?: ReactNode }>).props.children,
    )
      .map(textOf)
      .join("");
  return "";
}

/**
 * Props React Native's types do not declare, which react-native-web passes to
 * the DOM and native ignores: the web half of a control's description.
 */
function webOnly(props: Record<string, unknown>): object {
  return props;
}

/**
 * Join the classes that apply, the later winning a conflict. Utilities of one
 * kind (`px-4` and `px-0`, two border colours) resolve by stylesheet order,
 * not by the order they are listed in — so a state or variant slot would lose
 * to the base slot it is meant to override. tailwind-merge keeps the last.
 */
function cx(...cs: (string | false | undefined | null)[]): string {
  return twMerge(cs.filter(Boolean).join(" "));
}

/** An own slot and an author's class: merged, the author's winning, or replaced. */
function mergeClass(own: string | undefined, given: ClassValue | undefined): string | undefined {
  if (given === undefined) return own;
  if (typeof given === "object") return given.replace;
  return cx(own, given) || undefined;
}

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
    [required && requiredWords, textOf(p.error ?? p.helpText), textOf(count)]
      .filter(Boolean)
      .join(". ") || undefined;
  const web = describedBy({ ...p, count });
  return {
    "aria-label": textOf(p.label) || undefined,
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

function NativeFieldShell(p: FieldShellProps) {
  const t = useNativeTheme().shell;
  const [helpOpen, setHelpOpen] = useState(false);
  const hasLabel = p.label !== undefined && p.label !== null;
  const after = p.labelPosition === "after";
  const labelEnd = p.helpPlacement === "labelEnd" && !empty(p.helpText);
  const label = hasLabel && !p.hideLabel && (
    <Text
      id={fieldLabelId(p.id)}
      className={mergeClass(t.label, p.labelClassName)}
      // Native: the control carries the name, and a nested Text merges into
      // this one, so the marker would be read with it ("Name star"). The
      // web's aria-labelledby still names the control by this element.
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {p.label}
      {p.required && (
        <Text aria-hidden className={t.required}>
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
      aria-label={[t.helpButton.text, textOf(p.label)].filter(Boolean).join(": ")}
      aria-expanded={helpOpen}
      onPress={() => setHelpOpen((o) => !o)}
      className={t.helpButton.className}
    >
      <Text aria-hidden>{t.helpButton.icon}</Text>
    </Pressable>
  );
  return (
    <View className={mergeClass(t.className, p.className)}>
      {after ? (
        // A trailing label: the control, its words, then any help button —
        // the order it is read in is the order it is seen in.
        <View className={t.afterRow}>
          {p.children}
          {label}
          {helpButton}
        </View>
      ) : (
        <>
          {label && helpButton ? (
            <View className={t.labelRow}>
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
          className={t.help}
          style={helpOpen ? undefined : { display: "none" }}
        >
          {p.helpText}
        </Text>
      ) : (
        !empty(p.helpText) &&
        empty(p.error) && (
          <Text id={fieldHelpId(p.id)} className={t.help}>
            {p.helpText}
          </Text>
        )
      )}
      {p.required && p.describeRequired && (
        // Words for the web's description; native says it in the hint.
        <Text id={fieldRequiredId(p.id)} style={{ display: "none" }}>
          {t.requiredNote}
        </Text>
      )}
      {!empty(p.error) && (
        <Text id={fieldErrorId(p.id)} className={t.error}>
          {p.error}
        </Text>
      )}
      {p.count != null && (
        <Text id={fieldCountId(p.id)} className={p.countOver ? t.countOver : t.count}>
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
  return (
    <View
      className={mergeClass(
        cx(t.className, focused && t.focused, p.invalid && t.invalid, p.disabled && t.disabled),
        p.className,
      )}
    >
      {p.start !== undefined && edge(p.start)}
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
          className: t.input,
        },
        state,
      )}
      {p.end !== undefined && edge(p.end)}
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
      error={p.error}
      count={count}
      countOver={countOver}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
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
        render={(slot) => (
          <TextInput
            id={slot.id}
            ref={slot.ref as never}
            className={mergeClass(slot.className, p.textClassName)}
            value={ctl.value}
            onChangeText={ctl.setValue}
            onFocus={() => (slot.onFocus as (() => void) | undefined)?.()}
            onBlur={() => {
              (slot.onBlur as (() => void) | undefined)?.();
              ctl.onBlur();
            }}
            editable={!slot.disabled && !slot.readOnly}
            readOnly={slot.readOnly}
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
            aria-disabled={slot.disabled || undefined}
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
  const locked = ctl.state.disabled || ctl.state.readOnly;
  // Native has no focus to leave: a press is the touch.
  const toggle = (v: boolean) => {
    ctl.setChecked(v);
    ctl.onBlur();
  };
  const a11y = fieldA11y(p);
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
      labelClassName={p.labelClassName}
    >
      {t.control === "switch" ? (
        <Switch
          id={p.id}
          ref={ctl.elementRef as never}
          value={ctl.checked}
          onValueChange={toggle}
          disabled={locked}
          {...a11y}
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
          className={cx(t.box, ctl.checked && t.checked)}
          {...a11y}
          {...webOnly({ "aria-required": p.required || undefined })}
        >
          {ctl.checked && (
            <Text aria-hidden className={t.mark}>
              {t.markIcon}
            </Text>
          )}
        </Pressable>
      )}
    </Shell>,
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
  const entryCls = getProp(ctl.rc, p.entryClassName);
  const onCls = getProp(ctl.rc, p.selectedClassName);
  const offCls = getProp(ctl.rc, p.notSelectedClassName);
  const locked = ctl.state.disabled || ctl.state.readOnly;
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <View
        ref={leave.group as never}
        role="radiogroup"
        className={mergeClass(t.className, p.className)}
        {...a11y}
        aria-labelledby={p.label != null && !p.hideLabel ? fieldLabelId(p.id) : undefined}
        {...webOnly({ "aria-required": p.required || undefined })}
      >
        {ctl.options.map((o, i) => {
          const selected = ctl.stringValue === String(o.value);
          return (
            <View
              key={`${i}:${String(o.value)}`}
              className={mergeClass(mergeClass(t.entry, entryCls), selected ? onCls : offCls)}
            >
              <Pressable
                id={`${p.id}_${i}`}
                ref={i === 0 ? (ctl.elementRef as never) : undefined}
                role="radio"
                aria-checked={selected}
                aria-label={textOf(o.name)}
                disabled={locked || o.disabled}
                onPress={() => {
                  ctl.setFromString(String(o.value));
                  ctl.onBlur();
                }}
                onBlur={leave.onBlur as never}
                className={t.option}
              >
                <View className={cx(t.ring, selected && t.ringSelected)}>
                  {selected && <View className={t.dot} />}
                </View>
                <Text className={mergeClass(t.label, p.textClassName)}>{o.name}</Text>
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
  const locked = ctl.state.disabled || ctl.state.readOnly;
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <View
        ref={leave.group as never}
        role="group"
        className={mergeClass(t.className, p.className)}
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
              aria-label={textOf(o.name)}
              disabled={locked || o.disabled}
              onPress={() => {
                ctl.setSelected(o, !on);
                ctl.onBlur();
              }}
              onBlur={leave.onBlur as never}
              className={t.option}
              {...webOnly({ "aria-invalid": p.error ? true : undefined })}
            >
              <View className={cx(box.box, on && box.checked)}>
                {on && (
                  <Text aria-hidden className={box.mark}>
                    {box.markIcon}
                  </Text>
                )}
              </View>
              <Text className={mergeClass(t.label, p.textClassName)}>{o.name}</Text>
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <Frame
        id={p.id}
        describedBy={describedBy(p)}
        controlRef={ctl.elementRef}
        invalid={!!p.error}
        required={p.required}
        disabled={ctl.state.disabled}
        readOnly={ctl.state.readOnly}
        filled={ctl.stringValue !== ""}
        start={p.startIcon}
        end={p.endIcon}
        className={p.className}
        render={(slot) => (
          <Pressable
            id={slot.id}
            ref={slot.ref as never}
            role="combobox"
            aria-expanded={open}
            disabled={slot.disabled || slot.readOnly}
            onPress={() => setOpen(true)}
            className="flex-1"
            {...a11y}
            {...webOnly({ "aria-required": slot["aria-required"] })}
          >
            <Text className={chosen ? t.value : t.placeholder}>
              {chosen ? chosen.name : t.emptyText}
            </Text>
          </Pressable>
        )}
      />
      {open && (
        <Modal transparent visible animationType="slide" onRequestClose={close}>
          <Pressable className={t.backdrop} onPress={close} aria-label="Close">
            <View className={t.sheet}>
              <ScrollView role="list" aria-label={textOf(p.label) || undefined}>
                {choices.map((c) => {
                  const selected = c.value === ctl.stringValue;
                  return (
                    <Pressable
                      key={c.key}
                      role="option"
                      aria-selected={selected}
                      disabled={c.disabled}
                      onPress={() => {
                        ctl.setFromString(c.value);
                        close();
                      }}
                      className={cx(t.option, selected && t.optionSelected)}
                    >
                      <Text className={t.optionText}>{c.name}</Text>
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
  const start = p.startIcon != null && <View className={t.icon}>{p.startIcon}</View>;
  const end = p.endIcon != null && <View className={t.icon}>{p.endIcon}</View>;
  // Inline: the value in prose — no shell, no label.
  if (p.inline)
    return ctl.rendered(
      <Text id={p.id} className={mergeClass(t.inline, p.className ?? p.textClassName)}>
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
      error={p.error}
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <View
        id={p.id}
        className={mergeClass(t.className, p.className)}
        {...webOnly({ "aria-describedby": describedBy(p) })}
      >
        {start}
        <Text
          className={mergeClass(undefined, p.textClassName)}
          selectable={!p.noSelection}
        >
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
function wrapText(children: ReactNode, className?: string): ReactNode {
  return Children.map(children, (c) =>
    typeof c === "string" || typeof c === "number" ? <Text className={className}>{c}</Text> : c,
  );
}

function NativeContents(p: GroupRenderProps) {
  const { contents: t, text } = useNativeTheme();
  return (
    // Hiding is a style, not a class: it must work with no stylesheet.
    <View
      className={mergeClass(t.className, p.shellClassName)}
      style={p.hidden ? { display: "none" } : undefined}
    >
      {p.title !== undefined && p.title !== null && (
        <Text
          role="heading"
          aria-level={p.headingLevel}
          className={mergeClass(t.title, p.labelClassName)}
        >
          {p.title}
        </Text>
      )}
      {/* The author's className is the body's layout, in place of the theme's. */}
      <View className={p.className === undefined ? t.body : mergeClass(undefined, p.className)}>
        {wrapText(p.children, text.className)}
      </View>
    </View>
  );
}

function NativeInline(p: GroupRenderProps) {
  const { inline: t, text } = useNativeTheme();
  return (
    <View
      className={mergeClass(t.className, p.className)}
      style={p.hidden ? { display: "none" } : undefined}
    >
      {wrapText(p.children, text.className)}
    </View>
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
  const live = liveRegion(p.announce, p.tone);
  // An announced display hidden, or with nothing to say, keeps only its
  // live region — the same element, so content arriving in it is announced.
  if (p.regionOnly || (p.announce && textOf(content) === ""))
    return rendered(<View {...live} />);
  const text = (
    <Text
      {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
      aria-label={p.accessibleName}
      className={mergeClass(
        cx(
          heading
            ? cx(
                t.heading.className,
                t.heading.levels[
                  Math.min(Math.max(p.headingLevel, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6
                ],
              )
            : t.className,
          p.tone && t.tones[p.tone],
        ),
        p.className,
      )}
    >
      {content}
    </Text>
  );
  // Inline in prose: the text alone.
  if (p.inline && !p.announce) return rendered(text);
  return rendered(
    <View {...live} className={mergeClass(undefined, p.shellClassName)}>
      {text}
    </View>,
  );
}

function NativeIcon(p: IconDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const { icon: t, text } = useNativeTheme();
  const live = liveRegion(p.announce, p.tone);
  if (p.regionOnly) return rendered(<View {...live} />);
  const glyph = getProp(rc, p.icon);
  return rendered(
    <View
      {...live}
      role="img"
      aria-label={p.accessibleName}
      className={mergeClass(cx(t.className, p.tone && text.tones[p.tone]), p.shellClassName)}
    >
      {typeof glyph === "string" ? (
        <Text className={mergeClass(cx(t.className, p.tone && text.tones[p.tone]), p.className)}>
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
    <View {...live} className={mergeClass(undefined, p.shellClassName)}>
      <Text className={mergeClass(cx(t.className, p.tone && text.tones[p.tone]), p.className)}>
        {htmlText(html)}
      </Text>
    </View>,
  );
}

function NativeAction(p: ActionRenderProps) {
  const t = useNativeTheme().action;
  const variant = t.variants[p.variant];
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
  const icon = shown != null && shown !== false && <View className={t.iconClassName}>{shown}</View>;
  return (
    <Pressable
      role="button"
      disabled={p.disabled}
      accessibilityState={{ busy: !!p.busy, disabled: !!p.disabled }}
      aria-label={textOf(p.children ?? p.text) || undefined}
      onPress={() => p.onClick()}
      className={mergeClass(cx(t.className, variant.className, p.disabled && t.disabled), p.className)}
    >
      {p.iconPlacement !== "after" && icon}
      {p.iconPlacement !== "replace" &&
        (p.children ?? (
          <Text className={mergeClass(cx(t.textClassName, variant.textClassName), p.textClassName)}>
            {p.text}
          </Text>
        ))}
      {p.iconPlacement === "after" && icon}
    </Pressable>
  );
}

// ── Containers ────────────────────────────────────────────────────────

/** Every panel, always, the inactive ones hidden — an unmounted one validates nothing. */
function NativeTabs(p: TabsRenderProps) {
  const t = useNativeTheme().tabs;
  const base = useId();
  const tabId = (key: string) => `${base}-tab-${key}`;
  const panelId = (key: string) => `${base}-panel-${key}`;
  return (
    <View
      className={mergeClass(t.className, p.className)}
      style={p.hidden ? { display: "none" } : undefined}
    >
      <View role="tablist" className={t.list}>
        {p.items
          .filter((i) => !i.hidden)
          .map((i) => (
            <Pressable
              key={i.key}
              id={tabId(i.key)}
              role="tab"
              aria-selected={i.active}
              onPress={() => p.setActive(i.key)}
              className={cx(t.tab, i.active ? t.active : t.inactive)}
              {...webOnly({ "aria-controls": panelId(i.key) })}
            >
              <Text className={cx(t.tabText, i.active && t.activeText)}>{i.title}</Text>
              {i.invalid && (
                <Text aria-hidden className={t.invalidMarker}>
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
          className={t.panel}
          style={i.active ? undefined : { display: "none" }}
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
    <View style={p.hidden ? { display: "none" } : undefined}>
      {nav && (
        <View className={t.steps}>
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
                className={cx(t.step, n === p.index && t.active)}
              >
                <Text className={t.stepText}>
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
          className={t.page}
          style={i.active ? undefined : { display: "none" }}
        >
          {i.content}
        </View>
      ))}
      {nav && (
        <View className={t.nav}>
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
      <View className={mergeClass(t.inline, p.className)}>
        {p.title != null && <Text className={t.title}>{p.title}</Text>}
        {p.content}
      </View>
    );
  if (!p.open)
    return (
      <View
        style={{ display: "none" }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {p.content}
      </View>
    );
  return (
    <Modal transparent visible animationType="fade" onRequestClose={p.onClose}>
      <View className={t.backdrop} style={p.hidden ? { display: "none" } : undefined}>
        <View role="dialog" aria-modal className={mergeClass(t.surface, p.className)}>
          {p.title != null && (
            <Text role="heading" className={t.title}>
              {p.title}
            </Text>
          )}
          {p.content}
          <View className={t.actions}>
            <Action
              actionId={StandardActionIds.close}
              text="Close"
              variant="secondary"
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
  return (
    <View
      className={mergeClass(t.className, p.className)}
      style={p.hidden ? { display: "none" } : undefined}
    >
      <Pressable
        role="button"
        aria-expanded={p.open}
        onPress={() => p.setOpen(!p.open)}
        className={t.toggle}
        {...webOnly({ "aria-controls": p.id })}
      >
        <View aria-hidden style={p.open ? { transform: [{ rotate: "90deg" }] } : undefined}>
          <Text className={t.title}>{t.icon}</Text>
        </View>
        <Text className={t.title}>{p.title}</Text>
        {p.invalid && (
          <Text aria-hidden className={t.invalidMarker}>
            {"●"}
          </Text>
        )}
      </Pressable>
      <View id={p.id} className={t.content} style={p.open ? undefined : { display: "none" }}>
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
      className={p.shellClassName}
      labelClassName={p.labelClassName}
    >
      <View className={mergeClass(t.className, p.className)}>
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
 * Native's own components and styled through {@link NativeTheme} (NativeWind
 * classes). Pass it to `FormProvider`.
 *
 * Behaviour never depends on a class: hidden regions, inactive tabs and
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
