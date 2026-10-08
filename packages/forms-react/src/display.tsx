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
   *
   * Composes with `hidden`: an announced display is never unmounted, and
   * while hidden it keeps an empty live region in the page, so showing it
   * is a change to content the region already holds — which is what screen
   * readers announce reliably. `hidden={(rc) => !rc.getValue(error)}` is
   * therefore the spelling for a message that appears on a failure. It
   * skips the `visibility` slot: no exit transition.
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
  /**
   * Only with `announce`: the display is hidden, but its live region stays.
   * Draw the live-region element and nothing else — no content, no box, out
   * of the layout — and keep it the same element when this turns `false`, so
   * the content arriving in it is announced. An announced display with no
   * content to show (an empty text) should draw the same way.
   */
  regionOnly?: boolean;
  /** Content, for a display that takes it. */
  children?: ReactNode;
  /**
   * The level a heading drawn here takes — the same a titled group's title
   * would take in this place (see {@link ScopeState.headingLevel}). For a
   * display that is drawn as a heading, such as a `TextDisplay` with
   * `heading`.
   */
  headingLevel: number;
}

/**
 * {@link TextDisplay}'s own props.
 *
 * @group Authoring
 */
export interface TextDisplayExtra {
  /** The text. */
  text?: FormProp<ReactNode>;
  /**
   * Draw the text as a heading — a page's own title, a card's — at the level
   * the form's outline gives this place: one below the titled group it sits
   * in, as a group title there would be. No author picks a number, so the
   * headings stay an outline as the form is rearranged.
   */
  heading?: FormProp<boolean>;
  /**
   * A named look — "lead", "tag", "statLabel" — that the implementation's
   * theme resolves. The form names a role and never a look, so the same
   * source draws under every implementation. A name the theme does not know
   * draws the base look, with a warning in development.
   */
  variant?: FormProp<string | undefined>;
}

declare const process: { env: { NODE_ENV?: string } } | undefined;
// The literal `process.env.NODE_ENV`, so bundlers fold it (see CLAUDE.md).
const IS_DEV: boolean =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";
const warned = new Set<string>();

/**
 * Report a `variant` an implementation's theme does not name, once per kind
 * and name, in development only. What every implementation calls when it
 * falls back to the base look, so the message is the same under each.
 *
 * @param kind - what carries it: `text`, `group`, `action`
 * @param variant - the name the form used
 * @group Implementations
 */
export function warnUnknownVariant(kind: string, variant: string): void {
  if (!IS_DEV) return;
  const key = kind + "\u0000" + variant;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(
    `Forms v2: no ${kind} variant "${variant}" in this implementation's theme; drawing the base look. Name it in the theme's ${kind} variants.`,
  );
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
    // An announced display stays mounted under `hidden` (see `announce`).
    const announce = getProp(rc, props.announce) ?? false;
    const renderProps: DisplayRenderProps = {
      accessibleName: getProp(rc, props.accessibleName),
      inline: scope.inline,
      className: getProp(rc, props.className),
      textClassName: getProp(rc, props.textClassName),
      shellClassName: getProp(rc, props.shellClassName),
      tone: getProp(rc, props.tone),
      announce,
      regionOnly: announce && presence === "hidden" ? true : undefined,
      children: props.children,
      headingLevel: scope.headingLevel,
    };
    const impl = (
      <Impl {...renderProps} {...extraProps(props, displayContractKeys)} />
    );
    return rendered(
      designChrome(
        announce ? (
          impl
        ) : (
          <Visibility visible={presence !== "hidden"}>{impl}</Visibility>
        ),
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
