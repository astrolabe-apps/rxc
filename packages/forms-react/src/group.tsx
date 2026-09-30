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
 * A flex body, resolved: {@link StackProps} without its children or class.
 *
 * @group Authoring
 */
export interface StackLayout {
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
   * Make the body itself a flex box. Absent, the body is the implementation's
   * standard group body. Use this rather than a {@link Stack} inside the group
   * when the flex box *is* the body: `className` lands on the body, and a
   * `Stack` would be a second element it does not reach.
   */
  layout?: FormProp<StackLayout | undefined>;
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
  /** The heading, if any. */
  title?: ReactNode;
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
  layout?: StackLayout;
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
    const scope = useMemo(
      () => (options?.inline ? narrowScope(bound, { inline: true }) : bound),
      [bound],
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
      title: getProp(rc, props.title),
      className: getProp(rc, props.className),
      shellClassName: getProp(rc, props.shellClassName),
      labelClassName: getProp(rc, props.labelClassName),
      labelTextClassName: getProp(rc, props.labelTextClassName),
      hidden: presence !== "rendered",
      invalid: validation ? validation.showingErrors(rc) : undefined,
      layout: getProp(rc, props.layout),
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
  "validationKey",
  "children",
]);
