import type { TextStyle, ViewStyle } from "react-native";
import {
  resolveColor,
  resolveStyleTokens,
  splitPortableStyle,
  type LookState,
  type PortableStyle,
} from "@rx-controls/forms-react";

/**
 * What a look gives one element: {@link PortableStyle}, as a value or as a
 * function of the element's {@link LookState} (`pressed`, `focused`,
 * `width` …). `{ replace }` stands in for the implementation's own styling
 * of the element (and for any earlier look's part) instead of layering over
 * it.
 *
 * Colours may be theme tokens (`$accent`, `$danger/10`), resolved from
 * {@link NativeTheme.tokens}. This build draws no classes: a look is styles.
 *
 * @group Theming
 */
export type NativeLookPart =
  | PortableStyle
  | ((state: LookState) => PortableStyle)
  | { replace: PortableStyle | ((state: LookState) => PortableStyle) };

/**
 * One look: the parts of a boundary it styles. A part left out says nothing.
 *
 * - `shell` — what sits in the parent: a field's wrapper, a group's wrapper.
 * - `control` — the control, a group's body, an action's button.
 * - `text` — the element's words.
 * - `label` / `labelText` — a label's container and its words (one `Text` on
 *   native, which takes both).
 * - `icon` — around an action's icon.
 * - `entry` / `selected` / `notSelected` — a radio's option wrapper: always,
 *   and by whether it is the chosen one.
 *
 * @group Theming
 */
export interface NativeLook {
  shell?: NativeLookPart;
  control?: NativeLookPart;
  text?: NativeLookPart;
  label?: NativeLookPart;
  labelText?: NativeLookPart;
  icon?: NativeLookPart;
  entry?: NativeLookPart;
  selected?: NativeLookPart;
  notSelected?: NativeLookPart;
}

/** The parts a {@link NativeLook} can name. */
export type NativeLookPartName = keyof NativeLook;

/** What one part came to: styles for the box and for the words inside it. */
export interface ResolvedPart {
  /** For the container element. */
  box: ViewStyle | undefined;
  /** For the words — a `Text`, or a `TextInput`'s own text. */
  text: TextStyle | undefined;
  /** The look replaced the implementation's own styling of this element. */
  replace: boolean;
}

function evaluate(
  part: NativeLookPart | undefined,
  state: LookState,
): { style: PortableStyle | undefined; replace: boolean } {
  if (part === undefined) return { style: undefined, replace: false };
  if (typeof part === "function") return { style: part(state), replace: false };
  if ("replace" in part) {
    const r = part.replace;
    return { style: typeof r === "function" ? r(state) : r, replace: true };
  }
  return { style: part, replace: false };
}

/**
 * One part of a boundary's look, with the author's own `style` over it: the
 * look first, the author's after, so the author wins. Box properties land in
 * `box`, text properties in `text`.
 *
 * `look` is one look or several, layered in order: a later look over an
 * earlier, a `{ replace }` part dropping what came before it.
 *
 * `all` says the element is only words (a `Text`): everything is `text`.
 *
 * @group Theming
 */
export function resolvePart(
  look: NativeLook | readonly (NativeLook | undefined)[] | undefined,
  part: NativeLookPartName,
  state: LookState,
  colors: Record<string, string>,
  authored?: PortableStyle,
  all = false,
): ResolvedPart {
  const layers: (NativeLook | undefined)[] = Array.isArray(look)
    ? (look as (NativeLook | undefined)[])
    : [look as NativeLook | undefined];
  let replace = false;
  let boxStyle: Record<string, unknown> = {};
  let textStyle: Record<string, unknown> = {};
  for (const layer of layers) {
    const from = evaluate(layer?.[part], state);
    if (from.replace) {
      boxStyle = {};
      textStyle = {};
      replace = true;
    }
    const a = splitPortableStyle(from.style && resolveStyleTokens(from.style, colors));
    boxStyle = { ...boxStyle, ...a.box };
    textStyle = { ...textStyle, ...a.text };
  }
  const b = splitPortableStyle(authored && resolveStyleTokens(authored, colors));
  const box = { ...boxStyle, ...b.box } as ViewStyle;
  const text = { ...textStyle, ...b.text } as TextStyle;
  const hasBox = Object.keys(box).length > 0;
  const hasText = Object.keys(text).length > 0;
  if (all) {
    const both = { ...box, ...text } as TextStyle;
    return { box: undefined, text: hasBox || hasText ? both : undefined, replace };
  }
  return {
    box: hasBox ? box : undefined,
    text: hasText ? text : undefined,
    replace,
  };
}

export { resolveColor };
