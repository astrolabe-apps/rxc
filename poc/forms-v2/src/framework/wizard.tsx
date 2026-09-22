import { useMemo, type ComponentType, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import {
  useControl,
  useControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp } from "./prop.js";
import { FormScopeProvider, narrowScope } from "./scope.js";
import { useRenderers } from "./renderers.js";
import {
  createValidationScope,
  useValidationScope,
  ValidationScopeProvider,
  type ValidationScope,
} from "./validationScope.js";
import type { ClassValue, FormProp, FormRenderers, Presence } from "./types.js";

export interface WizardPage {
  key: string;
  title: ReactNode;
  children: ReactNode;
}

export interface WizardProps {
  items: WizardPage[];
  /**
   * Where the page index lives. Bound, it survives a remount and can be
   * deep-linked or saved; omitted, it is component state — which is the right
   * default and the wrong one for a form you can come back to. A stateful
   * container has to offer both, and the choice is the author's.
   */
  page?: Control<number | undefined>;
  hidden?: FormProp<boolean>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
}

export interface WizardRenderProps {
  items: {
    key: string;
    title: ReactNode;
    content: ReactNode;
    active: boolean;
    invalid: boolean;
    visited: boolean;
  }[];
  index: number;
  canBack: boolean;
  canNext: boolean;
  /** Refused when the current page is invalid, which touches it instead. */
  next(): void;
  back(): void;
  goTo(index: number): void;
  stacked: boolean;
  hidden: boolean;
  className?: ClassValue;
}

export type WizardImplSource =
  | ComponentType<WizardRenderProps>
  | { key: keyof FormRenderers };

export function wizardRenderer(
  source: WizardImplSource,
): ComponentType<WizardProps> {
  function WizardBoundary(props: WizardProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const ctx = useControlContext();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const parentScope = useValidationScope();
    const { items, page } = props;

    const internal = useControl(0);
    const indexControl = page ?? internal;
    const index = Math.min(
      Math.max(rc.getValue(indexControl) ?? 0, 0),
      Math.max(items.length - 1, 0),
    );
    const stacked = scope.designMode;
    const hidden = scope.presence(rc) !== "rendered";
    const keyList = items.map((i) => i.key).join("|");

    const scopes = useMemo(() => {
      const m = new Map<string, ValidationScope>();
      for (const i of items)
        m.set(i.key, createValidationScope(ctx, parentScope, "page:" + i.key));
      return m;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx, parentScope, keyList]);

    const rendering = items.map((item, i) => {
      const active = i === index;
      // Not yet reached is still `silent`: it validates, which is what the
      // step marker reports and what refuses a premature Next.
      const presence: Presence = active || stacked ? "rendered" : "silent";
      const vscope = scopes.get(item.key)!;
      return {
        key: item.key,
        title: item.title,
        active: active || stacked,
        visited: i <= index,
        invalid: !vscope.isValid(rc),
        content: (
          <FormScopeProvider
            scope={narrowScope(scope, { presence: () => presence })}
          >
            <ValidationScopeProvider value={vscope}>
              {item.children}
            </ValidationScopeProvider>
          </FormScopeProvider>
        ),
      };
    });

    const currentValid = rendering[index] ? !rendering[index].invalid : true;
    const goTo = (i: number) =>
      update((wc) =>
        wc.setValue(indexControl, Math.min(Math.max(i, 0), items.length - 1)),
      );

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<WizardRenderProps>)
        : source
    ) as ComponentType<WizardRenderProps>;

    return rendered(
      <Impl
        items={rendering}
        index={index}
        canBack={index > 0}
        canNext={index < items.length - 1}
        next={() => {
          if (!currentValid) {
            scopes.get(items[index].key)!.touchAll();
            return;
          }
          goTo(index + 1);
        }}
        back={() => goTo(index - 1)}
        goTo={goTo}
        stacked={stacked}
        hidden={hidden}
        className={getProp(rc, props.className)}
      />,
    );
  }
  WizardBoundary.displayName = "WizardBoundary";
  return WizardBoundary;
}
