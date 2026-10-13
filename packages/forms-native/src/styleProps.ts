/**
 * The one place an element's styling becomes props.
 *
 * Every `View`, `Text`, `Pressable`, `TextInput` and `Image` in `native.tsx`
 * gets its styling through {@link sp}, and nowhere else:
 *
 * ```tsx
 * <View {...sp(theme.x, look.box, own.box)}>
 * ```
 *
 * **The contract.** `sp` takes the style pieces already resolved for one
 * element, in layering order (the theme's slot, the look's part, the
 * author's own — later wins), each a React Native style object or a falsy
 * value for "nothing", and returns the props to spread onto the component.
 * It decides nothing about *what* the pieces are; it only says how they reach
 * the element.
 *
 * In this build that is `{ style: [...] }`. A build that also draws classes
 * (a `className`, say) replaces this module and nothing else: the
 * pieces it is handed are the same, and it may turn them into `className`,
 * `style` or both.
 */

/** One piece of an element's styling: a style object, or nothing. */
export type StylePiece = object | false | null | undefined;

/** Pieces, nested: an array of them is flattened in order. */
export type StylePieces = readonly (StylePiece | StylePieces)[];

/** What {@link sp} returns: the props to spread onto a React Native component. */
export interface StyleProps {
  /** Typed `never`: assignable to any React Native component's own `style`. */
  style: never;
}

/** The props that style an element from its pieces, in layering order. */
export function sp(...pieces: (StylePiece | StylePieces)[]): StyleProps {
  const flat: object[] = [];
  const add = (p: StylePiece | StylePieces): void => {
    if (Array.isArray(p)) p.forEach(add);
    else if (p) flat.push(p as object);
  };
  pieces.forEach(add);
  return { style: (flat.length ? flat : undefined) as never };
}
