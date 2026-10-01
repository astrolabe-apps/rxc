import type { ComponentType, ReactNode } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import { useBoundScope } from "./scope.js";
import {
  bailout,
  boundaryName,
  designChrome,
  extraProps,
  resolveImpl,
  visibilityFor,
} from "./boundaryParts.js";

/**
 * What a display means, beyond its words: a failure, a caution, a note, a
 * success. Colour and meaning only — a message box is a layout decision, and
 * a counter turning red past its limit wants the colour with no box.
 *
 * @group Authoring
 */
export type Tone = "error" | "warning" | "info" | "success";

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
  /**
   * What the display means — drawn in the implementation's colour for it.
   * Derived like any prop: `(rc) => length(rc) > max ? "error" : undefined`.
   */
  tone?: FormProp<Tone | undefined>;
  /**
   * Announce the content to assistive technology when it appears or changes:
   * a live region — `role="alert"` for an `error` tone, `role="status"` for
   * anything else. For a message the user must not miss (a refused submit),
   * not for a value that changes as the user types (a character counter),
   * which would be read out on every keystroke. Separate from `tone` for
   * exactly that reason.
   */
  announce?: FormProp<boolean>;
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
  /** What it means: draw it in the implementation's colour for this tone. */
  tone?: Tone;
  /**
   * Make it a live region: `role="alert"` when the tone is `error`, else
   * `role="status"`, on an element that stays mounted — a live region
   * announces changes to content it already holds.
   */
  announce: boolean;
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
    const Visibility = visibilityFor(renderers, scope);
    const renderProps: DisplayRenderProps = {
      accessibleName: getProp(rc, props.accessibleName),
      inline: scope.inline,
      className: getProp(rc, props.className),
      textClassName: getProp(rc, props.textClassName),
      shellClassName: getProp(rc, props.shellClassName),
      tone: getProp(rc, props.tone),
      announce: getProp(rc, props.announce) ?? false,
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
  return bailout(DisplayBoundary);
}

const displayContractKeys: ReadonlySet<string> = new Set([
  "hidden",
  "accessibleName",
  "className",
  "textClassName",
  "shellClassName",
  "tone",
  "announce",
  "children",
]);
