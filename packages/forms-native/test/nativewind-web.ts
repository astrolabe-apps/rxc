import * as runtime from "react/jsx-runtime";
import * as dev from "react/jsx-dev-runtime";
import * as RN from "react-native";

/**
 * NativeWind's JSX runtime as it behaves on the web, for the suites: a
 * `className` on a React Native component becomes a react-native-web
 * compiled style (`$$css`), which react-native-web writes to the DOM as the
 * element's classes. The real runtime does that and more — it also turns the
 * classes into styles on native — but it loads React Native's own source
 * past the alias, and here only the classes matter: what a layout class or a
 * theme slot lands on.
 */
type Props = Record<string, unknown> | null | undefined;

/**
 * The components NativeWind styles — React Native's own. Any other
 * component's `className` is a prop of its own (a shell's, a frame's), and
 * passes through untouched, as it does under NativeWind.
 */
const styled = new Set<unknown>([
  RN.View,
  RN.Text,
  RN.TextInput,
  RN.Pressable,
  RN.ScrollView,
  RN.Switch,
  RN.ActivityIndicator,
  RN.Image,
]);

function withClasses(type: unknown, props: Props): Props {
  if (!styled.has(type) || !props || typeof props.className !== "string") return props;
  const { className, ...rest } = props;
  if (!className) return rest;
  return { ...rest, style: [{ $$css: true, className }, rest.style] };
}

export const Fragment = runtime.Fragment;

export function jsx(type: never, props: Props, key?: string) {
  return runtime.jsx(type, withClasses(type, props) as never, key);
}

export function jsxs(type: never, props: Props, key?: string) {
  return runtime.jsxs(type, withClasses(type, props) as never, key);
}

/** The development runtime's entry, which the tests' own JSX compiles to. */
export function jsxDEV(
  type: never,
  props: Props,
  key: string | undefined,
  isStatic: boolean,
  source?: unknown,
  self?: unknown,
) {
  return (dev as unknown as { jsxDEV: Function }).jsxDEV(
    type,
    withClasses(type, props),
    key,
    isStatic,
    source,
    self,
  );
}
