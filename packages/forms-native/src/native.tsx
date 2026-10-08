import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  countText,
  describedBy,
  fieldCountId,
  fieldErrorId,
  fieldHelpId,
  fieldLabelId,
  getProp,
  mergeClass,
  useFieldShell,
  useInputFrame,
  useTextInput,
  type ActionRenderProps,
  type FieldShellProps,
  type FormElementProps,
  type FormRenderers,
  type FrameState,
  type GroupRenderProps,
  type InputFrameProps,
  type TextDisplayRenderProps,
  type TextFieldRenderProps,
} from "@rx-controls/forms-react";
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

/** Join the classes that apply. */
function cx(...cs: (string | false | undefined | null)[]): string {
  return cs.filter(Boolean).join(" ");
}

// ── Shell and frame ───────────────────────────────────────────────────

function NativeFieldShell(p: FieldShellProps) {
  const t = useNativeTheme().shell;
  const hasLabel = p.label !== undefined && p.label !== null;
  return (
    <View className={mergeClass(t.className, p.className)}>
      {/* A hidden label is not drawn: the control carries the name itself. */}
      {hasLabel && !p.hideLabel && (
        <Text
          id={fieldLabelId(p.id)}
          className={mergeClass(t.label, p.labelClassName)}
        >
          {p.label}
          {p.required && (
            <Text aria-hidden className={t.required}>
              {" *"}
            </Text>
          )}
        </Text>
      )}
      {p.children}
      {p.helpText != null && !p.error && (
        <Text id={fieldHelpId(p.id)} className={t.help}>
          {p.helpText}
        </Text>
      )}
      {p.error != null && (
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
  const name = textOf(p.label) || undefined;
  // Native's description: the error in place of the help, then the count.
  const hint =
    [textOf(p.error ?? p.helpText), textOf(count)].filter(Boolean).join(". ") ||
    undefined;
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
      error={p.error}
      count={count}
      countOver={countOver}
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
            // The name: a string for native (and iOS, which has no
            // labelledby), the label element by id where it is drawn.
            aria-label={name}
            aria-labelledby={
              name !== undefined && !p.hideLabel ? fieldLabelId(p.id) : undefined
            }
            aria-disabled={slot.disabled || undefined}
            accessibilityHint={hint}
            {...webOnly({
              "aria-describedby": slot["aria-describedby"],
              "aria-invalid": slot["aria-invalid"],
              "aria-required": slot["aria-required"],
            })}
          />
        )}
      />
    </Shell>,
  );
}

// ── Groups, displays, actions ─────────────────────────────────────────

function NativeContents(p: GroupRenderProps) {
  const t = useNativeTheme().contents;
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
        {p.children}
      </View>
    </View>
  );
}

function NativeInline(p: GroupRenderProps) {
  const t = useNativeTheme().inline;
  return (
    <View
      className={mergeClass(t.className, p.className)}
      style={p.hidden ? { display: "none" } : undefined}
    >
      {p.children}
    </View>
  );
}

function NativeText(p: TextDisplayRenderProps): Rendered {
  const { rc, rendered } = useReactive();
  const t = useNativeTheme().text;
  const content = getProp(rc, p.text) ?? p.children;
  const heading = !p.inline && !!getProp(rc, p.heading);
  const role = p.announce ? (p.tone === "error" ? "alert" : "status") : undefined;
  // An announced display hidden, or with nothing to say, keeps only its
  // live region — the same element, so content arriving in it is announced.
  if (p.regionOnly || (p.announce && textOf(content) === ""))
    return rendered(<View role={role} />);
  return rendered(
    <View role={role} className={mergeClass(undefined, p.shellClassName)}>
      <Text
        {...(heading ? { role: "heading", "aria-level": p.headingLevel } : {})}
        className={mergeClass(
          heading
            ? cx(
                t.heading.className,
                t.heading.levels[
                  Math.min(Math.max(p.headingLevel, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6
                ],
              )
            : t.className,
          p.className,
        )}
      >
        {content}
      </Text>
    </View>,
  );
}

function NativeAction(p: ActionRenderProps) {
  const t = useNativeTheme().action;
  const variant = t.variants[p.variant];
  const icon = p.busy ? <ActivityIndicator size="small" /> : p.icon;
  return (
    <Pressable
      role="button"
      disabled={p.disabled}
      aria-disabled={p.disabled || undefined}
      aria-busy={p.busy || undefined}
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

/** React Native has no form element: submission is the submit action's. */
function NativeForm(p: FormElementProps) {
  return <View>{p.children}</View>;
}

/** A slot the spike has not drawn yet: visible, so nothing passes by being empty. */
function unbuilt(slot: string) {
  function Unbuilt() {
    return <Text>{`forms-native: "${slot}" is not built yet`}</Text>;
  }
  Unbuilt.displayName = `Unbuilt(${slot})`;
  return Unbuilt;
}

/**
 * The React Native implementation — a spike: the text field, groups, text,
 * actions and the form are drawn; the other slots say they are not built.
 */
export const nativeRenderers: FormRenderers = {
  name: "native",
  textfield: NativeTextField,
  checkbox: unbuilt("checkbox"),
  select: unbuilt("select"),
  radio: unbuilt("radio"),
  checkList: unbuilt("checkList"),
  displayOnly: unbuilt("displayOnly"),
  action: NativeAction,
  text: NativeText,
  html: unbuilt("html"),
  icon: unbuilt("icon"),
  contents: NativeContents,
  inline: NativeInline,
  tabs: unbuilt("tabs"),
  wizard: unbuilt("wizard"),
  dialog: unbuilt("dialog"),
  disclosure: unbuilt("disclosure"),
  elements: unbuilt("elements"),
  fieldShell: NativeFieldShell,
  inputFrame: NativeInputFrame,
  visibility: ({ visible, children }) => (visible ? <>{children}</> : null),
  form: NativeForm,
};
