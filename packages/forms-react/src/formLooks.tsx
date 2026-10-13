import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ClassValue } from "./props.js";

/**
 * What a look gives each part of a boundary, as classes: the form of a look
 * that travels with a form rather than living in a theme. The loader derives
 * one from each distinct combination of a legacy control's class slots.
 *
 * Only an implementation that styles with classes — html, and React Native
 * under NativeWind — can draw one; any other ignores it. A part is a class
 * string, added to the implementation's own, or `{ replace }`.
 *
 * | part | the element |
 * |---|---|
 * | `shell` | what sits in the parent |
 * | `control` | the control; a group's body; an action's button |
 * | `text` | the element's words |
 * | `label` / `labelText` | a label's container and its words |
 * | `icon` | around an action's icon |
 * | `entry` / `selected` / `notSelected` | a radio's option wrapper, and its two states |
 *
 * @group Implementations
 */
export type ClassLook = {
  [P in
    | "shell"
    | "control"
    | "text"
    | "label"
    | "labelText"
    | "icon"
    | "entry"
    | "selected"
    | "notSelected"]?: ClassValue;
};

/**
 * A form's own looks by name. An implementation looks a name up in its
 * theme's looks first and here second, so a theme can restyle a name a form
 * brought.
 *
 * @group Implementations
 */
export type ClassLooks = Readonly<Record<string, ClassLook>>;

const NONE: ClassLooks = {};
const FormLooksContext = createContext<ClassLooks>(NONE);

/**
 * Supply a form's own looks to everything below, over the enclosing
 * provider's: a name given here replaces the same name above it. Pass a
 * stable object — what the loader returns for a form — so the region does not
 * re-resolve every render.
 *
 * @group Implementations
 */
export function FormLooksProvider({
  looks,
  children,
}: {
  looks: ClassLooks;
  children: ReactNode;
}): ReactNode {
  const parent = useContext(FormLooksContext);
  const merged = useMemo(
    () => (parent === NONE ? looks : { ...parent, ...looks }),
    [parent, looks],
  );
  return <FormLooksContext.Provider value={merged}>{children}</FormLooksContext.Provider>;
}

/**
 * The looks the form brought with it, by name — empty outside a
 * {@link FormLooksProvider}.
 *
 * @group Implementations
 */
export function useFormLooks(): ClassLooks {
  return useContext(FormLooksContext);
}
