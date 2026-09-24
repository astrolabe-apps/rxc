import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp } from "./prop.js";
import { useRenderers } from "./renderers.js";
import type { ActionProps, ActionRenderProps, FormRenderers } from "./types.js";

export type ActionOverrides = Record<string, ComponentType<ActionRenderProps>>;

const OverridesCtx = createContext<ActionOverrides>({});

export function useActionOverrides(): ActionOverrides {
  return useContext(OverridesCtx);
}

/**
 * Per-id appearance, provided by the **app** rather than the implementation —
 * the registry says what a button looks like here, this says what *this*
 * button looks like. Nests, so it can be scoped to a section, and composes by
 * spreading.
 *
 * A map rather than a matcher list: the only predicate anyone has ever needed
 * for an action is its id, and a map is O(1), obviously scoped, and trivial to
 * compose. Widening it to matchers later would be evidence-driven.
 */
export function ActionOverrideProvider({
  value,
  children,
}: {
  value: ActionOverrides;
  children: ReactNode;
}) {
  const parent = useActionOverrides();
  const merged = useMemo(() => ({ ...parent, ...value }), [parent, value]);
  return <OverridesCtx value={merged}>{children}</OverridesCtx>;
}

export type ActionImplSource =
  | ComponentType<ActionRenderProps>
  | { key: keyof FormRenderers };

/**
 * The action boundary: resolves `FormProp`s, folds the lock cascade, holds
 * busy state across an async handler, and stubs the handler in design mode.
 *
 * Every button anyone draws is one of these — an author's `<Action>`, a
 * collection's Add, a modal's Apply, a wizard's Next. There is no chrome-only
 * path: a `useAction(id)` that returned the implementation's button for other
 * renderers to compose was tried and removed, because every composed button
 * turned out to want exactly what the boundary provides (busy, the lock, the
 * design-mode stub, the override map), and its call sites repeated the id and
 * filled in `busy={false}` by hand. README finding 27.
 */
export function actionRenderer(
  source: ActionImplSource,
): ComponentType<ActionProps> {
  function ActionBoundary(props: ActionProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const renderers = useRenderers();
    const overrides = useActionOverrides();
    const scope = useBoundScope(props);
    const busy = useControl(false);

    const hidden = scope.presence(rc) !== "rendered";
    const disabled = scope.disabled(rc) || rc.getValue(busy);
    const disableType = props.disableType ?? "self";
    const lock = scope.globalLock;
    const onClick = () => {
      if (scope.designMode || disabled) return;
      const r = props.onClick?.();
      if (r instanceof Promise) {
        // "self" holds this button; "global" also holds the form's lock,
        // which the root scope reads as `disabled` for every boundary.
        const global = disableType === "global" && lock;
        update((wc) => {
          if (disableType !== "none") wc.setValue(busy, true);
          if (global) wc.setValue(lock, rc.getValue(lock) + 1);
        });
        r.finally(() =>
          update((wc) => {
            wc.setValue(busy, false);
            if (global) wc.setValue(lock, Math.max(0, rc.getValue(lock) - 1));
          }),
        );
      }
    };

    const Impl = (overrides[props.actionId] ??
      ("key" in source
        ? (renderers[source.key] as ComponentType<ActionRenderProps>)
        : source)) as ComponentType<ActionRenderProps>;

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
  ActionBoundary.displayName = "ActionBoundary";
  return ActionBoundary;
}
