import type { ComponentType, ReactNode } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import { useBoundScope } from "./scope.js";
import {
  boundaryName,
  designChrome,
  extraProps,
  resolveImpl,
} from "./boundaryParts.js";

/**
 * What an author writes on a display: static content with **no binding**. It
 * keeps presence, the class slots and design mode, and has none of what needs
 * a field — validators, `clearHidden`, the locks.
 *
 * @group Authoring
 */
export interface DisplayProps {
  /** Hide the display. */
  hidden?: FormProp<boolean | undefined>;
  /**
   * The display's accessible name. Redundant on one that already renders text;
   * load-bearing on one that does not, such as an icon. Whether it is also
   * shown — a tooltip, a `title` — is the implementation's choice.
   */
  accessibleName?: FormProp<string>;
  /** The element. */
  className?: FormProp<ClassValue>;
  /** Its text. */
  textClassName?: FormProp<ClassValue>;
  /** The wrapper it sits in. */
  shellClassName?: FormProp<ClassValue>;
  /** Content, for a display that takes it. */
  children?: ReactNode;
}

/**
 * What a display implementation receives.
 *
 * @group Implementations
 */
export interface DisplayRenderProps {
  /** The accessible name, if the author gave one. */
  accessibleName?: string;
  /** Inside an inline container: an inline element in prose, not a block. */
  inline?: boolean;
  /** The element. */
  className?: ClassValue;
  /** Its text. */
  textClassName?: ClassValue;
  /** The wrapper it sits in. */
  shellClassName?: ClassValue;
  /** Content, for a display that takes it. */
  children?: ReactNode;
}

/**
 * {@link TextDisplay}'s own prop.
 *
 * @group Authoring
 */
export interface TextDisplayExtra {
  /** The text. */
  text?: FormProp<ReactNode>;
}

/**
 * {@link HtmlDisplay}'s own prop.
 *
 * @group Authoring
 */
export interface HtmlDisplayExtra {
  /** Markup to render as it is. The caller is responsible for it being safe. */
  html?: FormProp<string>;
}

/**
 * {@link IconDisplay}'s own prop.
 *
 * @group Authoring
 */
export interface IconDisplayExtra {
  /**
   * The icon, as a node — the same vocabulary as an action's `icon` and a
   * field's `startIcon` / `endIcon`. What draws it is the author's choice; the
   * implementation places it and names it.
   */
  icon?: FormProp<ReactNode>;
}

/**
 * What the `text` slot receives.
 *
 * @group Implementations
 */
export type TextDisplayRenderProps = DisplayRenderProps & TextDisplayExtra;

/**
 * What the `html` slot receives.
 *
 * @group Implementations
 */
export type HtmlDisplayRenderProps = DisplayRenderProps & HtmlDisplayExtra;

/**
 * What the `icon` slot receives.
 *
 * @group Implementations
 */
export type IconDisplayRenderProps = DisplayRenderProps & IconDisplayExtra;

/**
 * What a display boundary draws with: a component of its own, or a registry
 * slot.
 *
 * @group Extensions
 */
export type DisplayImplSource<P extends object> =
  | ComponentType<DisplayRenderProps & P>
  | RegistrySlot;

/**
 * Build a display component: presence, the class slots and design mode, with
 * no binding. Props outside the contract pass through to `source` untouched.
 *
 * @group Extensions
 */
export function displayRenderer<P extends object = {}>(
  source: DisplayImplSource<P>,
): ComponentType<DisplayProps & P> {
  function DisplayBoundary(props: DisplayProps & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const presence = scope.presence(rc);
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const Visibility = renderers.visibility;
    const renderProps: DisplayRenderProps = {
      accessibleName: getProp(rc, props.accessibleName),
      inline: scope.inline,
      className: getProp(rc, props.className),
      textClassName: getProp(rc, props.textClassName),
      shellClassName: getProp(rc, props.shellClassName),
      children: props.children,
    };
    return rendered(
      designChrome(
        <Visibility visible={presence !== "hidden"}>
          <Impl {...renderProps} {...extraProps(props, displayContractKeys)} />
        </Visibility>,
        scope.designMode,
      ),
    );
  }
  DisplayBoundary.displayName = boundaryName(
    "DisplayBoundary",
    source as ComponentType<never>,
  );
  return DisplayBoundary;
}

const displayContractKeys: ReadonlySet<string> = new Set([
  "hidden",
  "accessibleName",
  "className",
  "textClassName",
  "shellClassName",
  "children",
]);
