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

/**
 * The button for an id, for a renderer that needs to draw one — a collection's
 * Add, a modal's Apply. **Chrome only**: everything the framework guarantees
 * lives in the boundary below, so a button needing busy state or design-mode
 * stubbing is an `<Action>`, not this.
 */
export function useAction(actionId: string): ComponentType<ActionRenderProps> {
  const overrides = useActionOverrides();
  const { action } = useRenderers();
  return overrides[actionId] ?? action;
}

export type ActionImplSource =
  ComponentType<ActionRenderProps> | { key: keyof FormRenderers };

/**
 * The action boundary: resolves `FormProp`s, folds the lock cascade, holds
 * busy state across an async handler, and stubs the handler in design mode.
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
    const onClick = () => {
      if (scope.designMode || disabled) return;
      const r = props.onClick?.();
      if (r instanceof Promise) {
        update((wc) => wc.setValue(busy, true));
        r.finally(() => update((wc) => wc.setValue(busy, false)));
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
