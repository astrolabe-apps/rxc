import { useMemo, type ComponentType, type ReactNode } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import { FormScopeProvider, narrowScope, useBoundScope } from "./scope.js";
import {
  useChildValidationScope,
  useValidationScope,
  ValidationScopeProvider,
} from "./validationScope.js";
import {
  boundaryName,
  extraProps,
  republish,
  resolveImpl,
} from "./boundaryParts.js";

/**
 * A group body drawn as a flex box with no CSS — an inline style, or the
 * platform's own flex layout. Classes on `className` are the usual way to lay
 * out a body; this is for where a class cannot reach: the JSON loader, whose
 * output no host stylesheet scans, and a platform without CSS.
 *
 * @group Authoring
 */
export interface FlexLayout {
  /** Main axis. Absent is the platform's default, a row. */
  direction?: "column" | "row";
  /** Space between children. Absent is the implementation's default gap. */
  gap?: string | number;
  /** Distribution along the main axis. */
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  /** Alignment across it. */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /** Let children wrap onto further lines. */
  wrap?: boolean;
}

/**
 * What an author writes on a group. A group binds no data: it narrows the
 * scope for its children and draws a region around them.
 *
 * A group never unmounts its children, even when hidden — each clears its own
 * binding, and an unmounted boundary clears nothing. It hides itself instead,
 * on an element that does not change, which also hides any plain JSX among
 * the children.
 *
 * @group Authoring
 */
export interface GroupProps {
  /** Hide the region and everything in it. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock the region. */
  disabled?: FormProp<boolean>;
  /** Make the region read-only. */
  readOnly?: FormProp<boolean>;
  /** A heading over the content. Absent means none. */
  title?: FormProp<ReactNode>;
  /** The body. */
  className?: FormProp<ClassValue>;
  /** The wrapper around title and body. */
  shellClassName?: FormProp<ClassValue>;
  /** The title's container. */
  labelClassName?: FormProp<ClassValue>;
  /** The title's text. */
  labelTextClassName?: FormProp<ClassValue>;
  /**
   * Make the body a flex box without CSS — see {@link FlexLayout}. Absent, the
   * body is the implementation's standard group body, laid out by `className`.
   */
  layout?: FormProp<FlexLayout | undefined>;
  /**
   * Whether boundaries inside leave and arrive through the implementation's
   * transitions. `false` makes them appear and disappear at once, with no
   * transition wrapper around each — what a grid or flex body of fields
   * usually wants. The group's own hiding follows the scope it sits in;
   * absent inherits.
   */
  transitions?: boolean;
  /**
   * Clear the values of fields that become hidden inside this group, or keep
   * them — overriding the form's `clearHidden` for this part of it. A group
   * of optional answers each revealed by a switch can clear what is switched
   * off while the rest of the form keeps hidden values.
   */
  clearHidden?: boolean;
  /**
   * The group's name in the validation tree. Meaningful only on a group that
   * makes a scope — one built `{ scope: true }`, such as {@link Section}.
   */
  validationKey?: string;
  /** The content. */
  children: ReactNode;
}

/**
 * What a group implementation receives.
 *
 * @group Implementations
 */
export interface GroupRenderProps {
  /**
   * Which group this is: a `section` (a {@link Section}, or any group built
   * with `{ scope: true }` — a titled, scoped part of the form), `inline`
   * (an {@link InlineGroup}, or `{ inline: true }`), or plain `contents` (a
   * {@link Contents} — often an invisible wrapper that only shows or hides a
   * bit of form). What lets a renderer or an override style sections without
   * styling every region.
   */
  kind: "contents" | "section" | "inline";
  /** The heading, if any. */
  title?: ReactNode;
  /**
   * The title's heading level, 1–6, from where the group sits in the form —
   * see {@link ScopeState.headingLevel}. Draw the title as a heading of this
   * level (html: `role="heading"` and `aria-level`, or an `h1`–`h6`).
   */
  headingLevel: number;
  /** The body. */
  className?: ClassValue;
  /** The wrapper around title and body. */
  shellClassName?: ClassValue;
  /** The title's container. A single-element title applies both title slots. */
  labelClassName?: ClassValue;
  /** The title's text. */
  labelTextClassName?: ClassValue;
  /**
   * Hide the region **without changing the element tree** — a style or the
   * `hidden` attribute on the element already rendered. Rendering something
   * else in its place remounts every child.
   */
  hidden?: boolean;
  /**
   * A touched field inside the region is showing an error — rules written
   * elsewhere over the same data do not count. See
   * {@link ValidationScope.showingErrors}. Present only when the boundary was
   * built with `{ scope: true }`.
   */
  invalid?: boolean;
  /**
   * Draw the body as this flex box. An implementation with one body shape may
   * ignore it.
   */
  layout?: FlexLayout;
  /**
   * Whether the region's own hiding may transition. `false` must hide at
   * once — the `hidden` attribute rather than an animated collapse.
   */
  transitions: boolean;
  /** The content. */
  children: ReactNode;
}

/**
 * What a group boundary draws with: a component of its own, or a registry
 * slot.
 *
 * @group Extensions
 */
export type GroupImplSource<P extends object> =
  | ComponentType<GroupRenderProps & P>
  | RegistrySlot;

/**
 * Properties of a group boundary rather than of any one use of it.
 *
 * @group Extensions
 */
export interface GroupBoundaryOptions {
  /**
   * Make a validation scope for the region — a node in the tree
   * {@link useValidation} walks — and hand whether it is showing errors to
   * the implementation as `invalid`, for a header that shows a marker. Only a boundary that is
   * asked pays for it.
   */
  scope?: boolean;
  /** The children are inline prose: fields and displays inside draw no shell. */
  inline?: boolean;
}

/**
 * Build a group component: scope narrowing plus chrome. Props outside the
 * contract pass through to `source` untouched.
 *
 * @group Extensions
 */
export function groupRenderer<P extends object = {}>(
  source: GroupImplSource<P>,
  options?: GroupBoundaryOptions,
): ComponentType<GroupProps & P> {
  function GroupBoundary(props: GroupProps & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const bound = useBoundScope(props);
    // `inline` is the container's kind, not a prop, so it is a boundary
    // option — and reaches the children as a scope facet.
    const { transitions, clearHidden } = props;
    const title = getProp(rc, props.title);
    // A titled group is a level in the outline: what is inside it heads one
    // deeper. Inline prose has no outline.
    const titled = title !== undefined && title !== null && !options?.inline;
    const scope = useMemo(
      () =>
        options?.inline ||
        transitions !== undefined ||
        clearHidden !== undefined ||
        titled
          ? narrowScope(bound, {
              inline: options?.inline || undefined,
              transitions,
              clearHidden,
              headingLevel: titled ? bound.headingLevel + 1 : undefined,
            })
          : bound,
      [bound, transitions, clearHidden, titled],
    );
    const presence = scope.presence(rc);
    // Opt-in: only a group that is asked "is my content invalid" makes a
    // scope. It attaches to the enclosing one, so validity bubbles.
    const validation = useChildValidationScope(
      useValidationScope(),
      "section",
      props.validationKey,
      !!options?.scope,
    );
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    // One structure, always: the implementation hides the region on the
    // element it already renders. Rendering the children bare when hidden
    // would remount them, and leave any plain JSX among them on screen.
    const renderProps: GroupRenderProps = {
      kind: options?.inline ? "inline" : options?.scope ? "section" : "contents",
      title,
      headingLevel: bound.headingLevel,
      className: getProp(rc, props.className),
      shellClassName: getProp(rc, props.shellClassName),
      labelClassName: getProp(rc, props.labelClassName),
      labelTextClassName: getProp(rc, props.labelTextClassName),
      hidden: presence !== "rendered",
      invalid: validation ? validation.showingErrors(rc) : undefined,
      layout: getProp(rc, props.layout),
      // The region itself hides as the scope around it says; `transitions`
      // on the group is for what is inside.
      transitions: bound.transitions,
      children: props.children,
    };
    const body = (
      <Impl {...renderProps} {...extraProps(props, groupContractKeys)} />
    );
    return rendered(
      <FormScopeProvider scope={scope}>
        {republish(
          validation ? (
            <ValidationScopeProvider value={validation}>{body}</ValidationScopeProvider>
          ) : (
            body
          ),
          scope.disabled(rc),
          scope.readOnly(rc),
        )}
      </FormScopeProvider>,
    );
  }
  GroupBoundary.displayName = boundaryName(
    "GroupBoundary",
    source as ComponentType<never>,
  );
  return GroupBoundary;
}

const groupContractKeys: ReadonlySet<string> = new Set([
  "hidden",
  "disabled",
  "readOnly",
  "title",
  "className",
  "shellClassName",
  "labelClassName",
  "labelTextClassName",
  "layout",
  "transitions",
  "clearHidden",
  "validationKey",
  "children",
]);
