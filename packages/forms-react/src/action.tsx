import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import { useBoundScope, useInternalScope } from "./scope.js";
import { boundaryName, resolveImpl } from "./boundaryParts.js";

/**
 * A button's emphasis.
 *
 * @group Authoring
 */
export type ActionStyle = "primary" | "secondary" | "link";

/**
 * Where a button's icon goes relative to its text; `replace` draws the icon
 * alone and uses the text as the accessible name.
 *
 * @group Authoring
 */
export type IconPlacement = "before" | "after" | "replace";

/**
 * What a running asynchronous handler locks: nothing, this button, or the whole
 * form.
 *
 * @group Authoring
 */
export type DisableType = "none" | "self" | "global";

/**
 * What an author writes on a button.
 *
 * @group Authoring
 */
export interface ActionProps {
  /**
   * What the button does, in a camelCase word that names the deed — `apply`,
   * not `primaryButton`. The only handle a host has on a button it did not
   * write, and the key {@link ActionOverrideProvider} restyles by.
   */
  actionId: string;
  /** The label. */
  text?: FormProp<ReactNode>;
  /** An icon, as a node. */
  icon?: FormProp<ReactNode>;
  /** Where the icon goes. Default `before`. */
  iconPlacement?: FormProp<IconPlacement>;
  /**
   * The handler. One that returns a promise shows the button busy until it
   * settles, and holds the lock `disableType` names.
   */
  onClick?: () => void | Promise<void>;
  /** Hide the button. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock the button. */
  disabled?: FormProp<boolean>;
  /** What an asynchronous `onClick` locks while it runs. Default `self`. */
  disableType?: DisableType;
  /** Emphasis. Default `secondary`. */
  style?: FormProp<ActionStyle>;
  /** The button. */
  className?: FormProp<ClassValue>;
  /** Its text. */
  textClassName?: FormProp<ClassValue>;
  /** The wrapper it sits in. */
  shellClassName?: FormProp<ClassValue>;
  /** Content drawn inside the button in place of icon and text, for any style. */
  children?: ReactNode;
}

/**
 * What a button implementation receives — the same shape whether the button
 * was written by an author or drawn by another renderer (a collection's Add, a
 * dialog's Apply). Busy state, the lock cascade and the design-mode stub are
 * already folded in.
 *
 * @group Implementations
 */
export interface ActionRenderProps {
  /** Which button this is. */
  actionId: string;
  /** The label. */
  text?: ReactNode;
  /** The icon. */
  icon?: ReactNode;
  /** Where the icon goes. Absent means `before`. */
  iconPlacement?: IconPlacement;
  /** Call on click. */
  onClick: () => void;
  /** Draw disabled. */
  disabled: boolean;
  /** An asynchronous handler is running. */
  busy: boolean;
  /** Emphasis. */
  style: ActionStyle;
  /** The button. */
  className?: ClassValue;
  /** Its text. */
  textClassName?: ClassValue;
  /** The wrapper it sits in. */
  shellClassName?: ClassValue;
  /** Content to draw inside the button in place of icon and text. */
  children?: ReactNode;
}

/**
 * Per-id appearance: a button implementation for each action id that should
 * look different from the implementation's own.
 *
 * @group Authoring
 */
export type ActionOverrides = Record<string, ComponentType<ActionRenderProps>>;

/**
 * The props of {@link ActionOverrideProvider}.
 *
 * @group Authoring
 */
export interface ActionOverrideProviderProps {
  /** Overrides for this region, merged over any enclosing ones. */
  value: ActionOverrides;
  /** The region they apply to. */
  children: ReactNode;
}

/**
 * Restyle buttons by id, for a region — including buttons the author never
 * wrote, such as a collection's Add. Provided by the app, not the
 * implementation: the registry says what a button looks like here, this says
 * what *this* button looks like. Nests, so a section can override again.
 *
 * @group Authoring
 */
export function ActionOverrideProvider({
  value,
  children,
}: ActionOverrideProviderProps): ReactNode {
  const parent = useActionOverrides();
  const merged = useMemo(() => ({ ...parent, ...value }), [parent, value]);
  return <OverridesContext value={merged}>{children}</OverridesContext>;
}

const OverridesContext = createContext<ActionOverrides>({});

/**
 * The overrides in effect at this position.
 *
 * @group Extensions
 */
export function useActionOverrides(): ActionOverrides {
  return useContext(OverridesContext);
}

/**
 * The action ids the framework's own buttons use. Every button the framework
 * draws itself has one of these, so every one can be overridden. A definition
 * may rename one for a particular control, so two lists on one page can be
 * styled apart.
 *
 * @group Authoring
 */
export const StandardActionIds = {
  /** Append an element to a collection. */
  add: "add",
  /** Remove one element from a collection. */
  remove: "remove",
  /** Open a staged edit of one element. */
  edit: "edit",
  /** Commit a staged edit. */
  apply: "apply",
  /** Discard a staged edit. */
  cancel: "cancel",
  /** Advance a wizard. */
  next: "next",
  /** Go back a wizard page. */
  back: "back",
} as const;

/**
 * One of {@link StandardActionIds}.
 *
 * @group Authoring
 */
export type StandardActionId =
  (typeof StandardActionIds)[keyof typeof StandardActionIds];

/**
 * What an action boundary draws with: a component of its own, or a registry
 * slot.
 *
 * @group Extensions
 */
export type ActionImplSource = ComponentType<ActionRenderProps> | RegistrySlot;

/**
 * Build a button component: resolves the props, folds the lock cascade, holds
 * busy state across an asynchronous handler, applies the override for its id,
 * and does nothing in design mode. Every button anyone draws is one of these.
 *
 * @group Extensions
 */
export function actionRenderer(
  source: ActionImplSource,
): ComponentType<ActionProps> {
  function ActionBoundary(props: ActionProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const renderers = useRenderers();
    const overrides = useActionOverrides();
    const scope = useBoundScope(props);
    // The form's lock lives on the framework's own scope facet.
    const lock = useInternalScope().globalLock;
    const busy = useControl(false);

    // `silent` keeps the button, like every boundary; its container hides it.
    const hidden = scope.presence(rc) === "hidden";
    const disabled = scope.disabled(rc) || rc.getValue(busy);
    const disableType = props.disableType ?? "self";
    const onClick = () => {
      if (scope.designMode || disabled) return;
      const result = props.onClick?.();
      if (!(result instanceof Promise)) return;
      // `self` holds this button; `global` also holds the form's lock, which
      // the form reads as `disabled` for every boundary in it.
      const global = disableType === "global" ? lock : undefined;
      update((wc) => {
        if (disableType !== "none") wc.setValue(busy, true);
        if (global) wc.updateValue(global, (n) => n + 1);
      });
      void result.finally(() =>
        update((wc) => {
          wc.setValue(busy, false);
          if (global) wc.updateValue(global, (n) => Math.max(0, n - 1));
        }),
      );
    };
    const Impl = (overrides[props.actionId] ??
      resolveImpl(
        source as ComponentType<never>,
        renderers,
      )) as ComponentType<ActionRenderProps>;
    return rendered(
      hidden ? null : (
        <Impl
          actionId={props.actionId}
          text={getProp(rc, props.text)}
          icon={getProp(rc, props.icon)}
          iconPlacement={getProp(rc, props.iconPlacement) ?? "before"}
          className={getProp(rc, props.className)}
          textClassName={getProp(rc, props.textClassName)}
          shellClassName={getProp(rc, props.shellClassName)}
          onClick={onClick}
          disabled={disabled}
          busy={rc.getValue(busy)}
          style={getProp(rc, props.style) ?? "secondary"}
        >
          {props.children}
        </Impl>
      ),
    );
  }
  ActionBoundary.displayName = boundaryName(
    "ActionBoundary",
    source as ComponentType<never>,
  );
  return ActionBoundary;
}
