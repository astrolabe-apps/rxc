import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import {
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp, mergeClass } from "./prop.js";
import { FormScopeProvider, narrowScope } from "./scope.js";
import { useRenderers } from "./renderers.js";
import {
  createValidationScope,
  useValidationScope,
  ValidationScopeProvider,
  type ValidationScope,
} from "./validationScope.js";
import type { ClassValue, FormProp, FormRenderers, Presence } from "./types.js";

export interface TabItem {
  key: string;
  title: ReactNode;
  children: ReactNode;
}

export interface TabsProps {
  /**
   * Structured, not `children`. A container that needs per-child metadata
   * cannot take an opaque `ReactNode` — see the note in §8 of the doc.
   */
  items: TabItem[];
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
}

export interface TabsRenderProps {
  items: {
    key: string;
    title: ReactNode;
    /** Already wrapped in its own scope and validation scope. */
    content: ReactNode;
    active: boolean;
    invalid: boolean;
  }[];
  activeKey: string;
  setActive(key: string): void;
  /** Design mode: every panel shown at once. */
  stacked: boolean;
  hidden: boolean;
  className?: ClassValue;
}

export type TabsImplSource =
  | ComponentType<TabsRenderProps>
  | { key: keyof FormRenderers };

/**
 * The only thing that sets `silent`: an inactive panel is off screen and still
 * validating, which is why the state exists at all.
 *
 * Every panel is rendered, always — the implementation may not lazily mount
 * them, because a panel that never mounted registers nothing and validates
 * nothing. Each library has an escape hatch for this and this is what forces
 * it on: Ant's `forceRender`, Mantine's `keepMounted`, and MUI leaving panel
 * rendering to the caller in the first place.
 */
export function tabsRenderer(source: TabsImplSource): ComponentType<TabsProps> {
  function TabsBoundary(props: TabsProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const renderers = useRenderers();
    const ctx = useControlContext();
    const scope = useBoundScope(props);
    const parentScope = useValidationScope();
    const { items } = props;

    const active = useControl(items[0]?.key ?? "");
    const activeKey = rc.getValue(active);
    const stacked = scope.designMode;
    const hidden = scope.presence(rc) !== "rendered";
    const keyList = items.map((i) => i.key).join("|");

    // One validation scope per tab, kept across renders so registrations made
    // by fields inside survive a tab switch.
    const scopes = useMemo(() => {
      const m = new Map<string, ValidationScope>();
      for (const i of items)
        m.set(i.key, createValidationScope(ctx, parentScope, "tab:" + i.key));
      return m;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, parentScope, keyList]);

    const rendering = items.map((item) => {
      const isActive = item.key === activeKey;
      const presence: Presence = isActive || stacked ? "rendered" : "silent";
      const itemScope = narrowScope(scope, { presence: () => presence });
      const vscope = scopes.get(item.key)!;
      return {
        key: item.key,
        title: item.title,
        active: isActive || stacked,
        invalid: !vscope.isValid(rc),
        content: (
          <FormScopeProvider scope={itemScope}>
            <ValidationScopeProvider value={vscope}>
              {item.children}
            </ValidationScopeProvider>
          </FormScopeProvider>
        ),
      };
    });

    // If the active tab disappears, fall back to the first one.
    const known = items.some((i) => i.key === activeKey);
    useEffect(() => {
      if (!known && items[0]) update((wc) => wc.setValue(active, items[0].key));
    }, [known, items, active, update]);

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<TabsRenderProps>)
        : source
    ) as ComponentType<TabsRenderProps>;

    return rendered(
      <Impl
        items={rendering}
        activeKey={activeKey}
        setActive={(k) => update((wc) => wc.setValue(active, k))}
        stacked={stacked}
        hidden={hidden}
        className={getProp(rc, props.className)}
      />,
    );
  }
  TabsBoundary.displayName = "TabsBoundary";
  return TabsBoundary;
}

/** Shared by the implementations that want it. */
export function tabPanelClass(active: boolean): string | undefined {
  return mergeClass("ff-tabpanel", active ? undefined : "ff-tabpanel--off");
}
