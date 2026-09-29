import { type ComponentType, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp } from "./prop.js";
import { FormScopeProvider, narrowScope } from "./scope.js";
import { useRenderers } from "./renderers.js";
import {
  useChildValidationScope,
  useChildValidationScopes,
  useValidationScope,
  ValidationScopeProvider,
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
  hidden?: FormProp<boolean | undefined>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  className?: FormProp<ClassValue>;
  /**
   * The wizard's name in the validation tree. Its pages are its children,
   * keyed by item key — so "is the Who page still checking?" is
   * `useValidation().root.find(rc, validationKey)?.child(rc, "who")?.pending(rc)`.
   */
  validationKey?: string;
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
  /**
   * Waits for the page's async validators to settle, then advances — or, if
   * the page is invalid, touches it so its errors show and stays put. Returns
   * the promise so the button drawing it can show busy: an `<Action>` does
   * that for any `onClick` that returns one.
   */
  next(): Promise<void>;
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
    const wizardScope = useChildValidationScope(
      parentScope,
      "wizard",
      props.validationKey,
    );
    const scopes = useChildValidationScopes(
      wizardScope,
      "page",
      items.map((i) => i.key),
    );

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
        next={async () => {
          // The page's gate — the same `check()` a form's submit is.
          if (await scopes.get(items[index].key)!.check()) goTo(index + 1);
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
