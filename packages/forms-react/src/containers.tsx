import { useEffect, useMemo, type ComponentType, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import { getProp, type ClassValue, type FormProp } from "./props.js";
import { useRenderers, type RegistrySlot } from "./registry.js";
import {
  FormScopeProvider,
  narrowScope,
  useBoundScope,
  type Presence,
  type ScopeState,
} from "./scope.js";
import {
  useChildValidationScope,
  useChildValidationScopes,
  useValidationScope,
  ValidationScopeProvider,
  type ValidationScopeImpl,
} from "./validationScope.js";
import { boundaryName, resolveImpl } from "./boundaryParts.js";

/**
 * One panel's content: its scope — `rendered` when shown, `silent` when not —
 * and its validation scope, around the author's children. Memoised on what
 * it depends on, so a strip re-rendering does not hand every panel a new
 * scope object.
 */
function usePanels(
  scope: ScopeState,
  keys: string[],
  shown: (key: string) => boolean,
  scopes: Map<string, ValidationScopeImpl>,
): Map<string, ScopeState> {
  const signature = JSON.stringify(keys.map((k) => [k, shown(k)]));
  return useMemo(() => {
    const m = new Map<string, ScopeState>();
    for (const [k, on] of JSON.parse(signature) as [string, boolean][]) {
      const presence: Presence = on ? "rendered" : "silent";
      m.set(k, narrowScope(scope, { presence: () => presence }));
    }
    return m;
    // `scopes` is keyed the same way; its identity follows `keys`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, signature, scopes]);
}

function panel(
  scope: ScopeState,
  vscope: ValidationScopeImpl,
  children: ReactNode,
): ReactNode {
  return (
    <FormScopeProvider scope={scope}>
      <ValidationScopeProvider value={vscope}>{children}</ValidationScopeProvider>
    </FormScopeProvider>
  );
}

/**
 * One tab.
 *
 * @group Authoring
 */
export interface TabItem {
  /** Stable identity. */
  key: string;
  /** The tab's label. */
  title: ReactNode;
  /** The panel. */
  children: ReactNode;
}

/**
 * What an author writes on a tab strip. Structured rather than `children`,
 * because a container that needs per-child metadata cannot read it from an
 * opaque node.
 *
 * Inactive panels are `silent`: mounted, off screen, and still validating, so
 * an inactive tab can show that something in it is invalid.
 *
 * @group Authoring
 */
export interface TabsProps {
  /** The tabs, in order. */
  items: TabItem[];
  /** Hide the tab strip and every panel. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock every panel. */
  disabled?: FormProp<boolean>;
  /** Make every panel read-only. */
  readOnly?: FormProp<boolean>;
  /** The tab strip's outer element. */
  className?: FormProp<ClassValue>;
  /**
   * The tab strip's name in the validation tree. Its tabs are its children,
   * keyed by item key.
   */
  validationKey?: string;
}

/**
 * One tab, as the implementation sees it.
 *
 * @group Implementations
 */
export interface TabsRenderItem {
  /** Stable identity. */
  key: string;
  /** The tab's label. */
  title: ReactNode;
  /** The panel, already wrapped in its own scope. Render it always. */
  content: ReactNode;
  /** The active panel — or every panel, in design mode. */
  active: boolean;
  /** A rule in this panel has a published error. */
  invalid: boolean;
}

/**
 * What a tab-strip implementation receives.
 *
 * **Every panel must be mounted, always**, and an inactive one hidden with a
 * style or the `hidden` attribute. A panel that never mounted registers
 * nothing and validates nothing, so a library's lazy mounting has to be
 * turned off — and never through React's `<Activity>`, which keeps the markup
 * but tears down the effects validation lives in.
 *
 * @group Implementations
 */
export interface TabsRenderProps {
  /** The tabs, in order. */
  items: TabsRenderItem[];
  /** The active tab's key. */
  activeKey: string;
  /** Switch tabs. */
  setActive(key: string): void;
  /** Design mode: show every panel at once. */
  stacked: boolean;
  /** Hide the whole strip, without unmounting it. */
  hidden: boolean;
  /** The outer element. */
  className?: ClassValue;
}

/**
 * What a tabs boundary draws with.
 *
 * @group Extensions
 */
export type TabsImplSource = ComponentType<TabsRenderProps> | RegistrySlot;

/**
 * Build a tab-strip component: the active tab, a scope and a validation scope
 * per panel, and `silent` for the inactive ones.
 *
 * @group Extensions
 */
export function tabsRenderer(source: TabsImplSource): ComponentType<TabsProps> {
  function TabsBoundary(props: TabsProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const { items } = props;
    const keys = items.map((i) => i.key);

    const active = useControl(items[0]?.key ?? "");
    const activeKey = rc.getValue(active);
    const stacked = scope.designMode;
    // The strip's own scope, then one per tab under it, kept across renders
    // so what fields inside registered survives a tab switch.
    const stripScope = useChildValidationScope(
      useValidationScope(),
      "tabs",
      props.validationKey,
    );
    const scopes = useChildValidationScopes(stripScope, "tab", keys);
    const panels = usePanels(
      scope,
      keys,
      (k) => stacked || k === activeKey,
      scopes,
    );

    // If the active tab disappears, fall back to the first.
    const known = keys.includes(activeKey);
    useEffect(() => {
      if (!known && items[0]) update((wc) => wc.setValue(active, items[0].key));
    }, [known, items, active, update]);

    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: TabsRenderProps = {
      items: items.map((item) => ({
        key: item.key,
        title: item.title,
        active: stacked || item.key === activeKey,
        invalid: !scopes.get(item.key)!.isValid(rc),
        content: panel(panels.get(item.key)!, scopes.get(item.key)!, item.children),
      })),
      activeKey,
      setActive: (k) => update((wc) => wc.setValue(active, k)),
      stacked,
      hidden: scope.presence(rc) !== "rendered",
      className: getProp(rc, props.className),
    };
    return rendered(<Impl {...renderProps} />);
  }
  TabsBoundary.displayName = boundaryName(
    "TabsBoundary",
    source as ComponentType<never>,
  );
  return TabsBoundary;
}

/**
 * One wizard page.
 *
 * @group Authoring
 */
export interface WizardPage {
  /** Stable identity. */
  key: string;
  /** The step's label. */
  title: ReactNode;
  /** The page. */
  children: ReactNode;
}

/**
 * What an author writes on a wizard. Pages not yet reached are `silent`.
 *
 * @group Authoring
 */
export interface WizardProps {
  /** The pages, in order. */
  items: WizardPage[];
  /**
   * Where the page index lives. Bound, it survives a remount and can be saved
   * or deep-linked; absent, it is component state.
   */
  page?: Control<number | undefined>;
  /** Hide the wizard. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock every page. */
  disabled?: FormProp<boolean>;
  /** Make every page read-only. */
  readOnly?: FormProp<boolean>;
  /** The outer element. */
  className?: FormProp<ClassValue>;
  /**
   * The wizard's name in the validation tree. Its pages are its children,
   * keyed by item key — so "is the Who page still checking?" is
   * `useValidation().root.find(rc, "signup")?.child(rc, "who")?.pending(rc)`.
   */
  validationKey?: string;
}

/**
 * One page, as the implementation sees it.
 *
 * @group Implementations
 */
export interface WizardRenderItem {
  /** Stable identity. */
  key: string;
  /** The step's label. */
  title: ReactNode;
  /** The page, already scoped. Render it always, hidden when not active. */
  content: ReactNode;
  /** The current page — or every page, in design mode. */
  active: boolean;
  /** A rule on this page has a published error. */
  invalid: boolean;
  /** The user has been to this page. */
  visited: boolean;
}

/**
 * What a wizard implementation receives. The same mounting rule as
 * {@link TabsRenderProps}: every page, always.
 *
 * @group Implementations
 */
export interface WizardRenderProps {
  /** The pages, in order. */
  items: WizardRenderItem[];
  /** The current page. */
  index: number;
  /** There is a page before this one. */
  canBack: boolean;
  /** There is a page after this one. */
  canNext: boolean;
  /**
   * The page's {@link ValidationScope.check}, then advance if it passed: wait
   * for the page's asynchronous validators, and if a rule on the page fails,
   * touch the page so its errors show and stay. Returns the promise, so a
   * button drawing it shows busy.
   */
  next(): Promise<void>;
  /** Go back a page. */
  back(): void;
  /** Go to a page. */
  goTo(index: number): void;
  /** Design mode: show every page at once. */
  stacked: boolean;
  /** Hide the whole wizard, without unmounting it. */
  hidden: boolean;
  /** The outer element. */
  className?: ClassValue;
}

/**
 * What a wizard boundary draws with.
 *
 * @group Extensions
 */
export type WizardImplSource = ComponentType<WizardRenderProps> | RegistrySlot;

/**
 * Build a wizard component.
 *
 * @group Extensions
 */
export function wizardRenderer(
  source: WizardImplSource,
): ComponentType<WizardProps> {
  function WizardBoundary(props: WizardProps): Rendered {
    const { rc, rendered, update } = useReactive();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const { items, page } = props;
    const keys = items.map((i) => i.key);

    const internal = useControl(0);
    const indexControl = page ?? internal;
    const index = Math.min(
      Math.max(rc.getValue(indexControl) ?? 0, 0),
      Math.max(items.length - 1, 0),
    );
    const stacked = scope.designMode;
    const wizardScope = useChildValidationScope(
      useValidationScope(),
      "wizard",
      props.validationKey,
    );
    const scopes = useChildValidationScopes(wizardScope, "page", keys);
    // A page not reached yet is `silent`: it validates, which is what the
    // step marker reports and what refuses a premature Next.
    const panels = usePanels(
      scope,
      keys,
      (k) => stacked || keys.indexOf(k) === index,
      scopes,
    );
    const goTo = (i: number) =>
      update((wc) =>
        wc.setValue(indexControl, Math.min(Math.max(i, 0), items.length - 1)),
      );

    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: WizardRenderProps = {
      items: items.map((item, i) => ({
        key: item.key,
        title: item.title,
        active: stacked || i === index,
        visited: i <= index,
        invalid: !scopes.get(item.key)!.isValid(rc),
        content: panel(panels.get(item.key)!, scopes.get(item.key)!, item.children),
      })),
      index,
      canBack: index > 0,
      canNext: index < items.length - 1,
      // The page's gate — the same `check()` a form's submit is.
      next: async () => {
        const current = items[index];
        if (current && (await scopes.get(current.key)!.check())) goTo(index + 1);
      },
      back: () => goTo(index - 1),
      goTo,
      stacked,
      hidden: scope.presence(rc) !== "rendered",
      className: getProp(rc, props.className),
    };
    return rendered(<Impl {...renderProps} />);
  }
  WizardBoundary.displayName = boundaryName(
    "WizardBoundary",
    source as ComponentType<never>,
  );
  return WizardBoundary;
}

/**
 * What an author writes on a dialog. Its content is `silent` while closed, so a
 * required field inside a dialog that was never opened still reports, and
 * `clearHidden` never wipes it.
 *
 * @group Authoring
 */
export interface DialogProps {
  /** Open or closed — a value, a derivation, or a control to bind to. */
  open: FormProp<boolean>;
  /** The user dismissed the dialog. */
  onClose?: () => void;
  /** The heading. */
  title?: FormProp<ReactNode>;
  /** Hide the dialog and its content. */
  hidden?: FormProp<boolean | undefined>;
  /** Lock the content. */
  disabled?: FormProp<boolean>;
  /** Make the content read-only. */
  readOnly?: FormProp<boolean>;
  /** The dialog. */
  className?: FormProp<ClassValue>;
  /** The dialog's name in the validation tree. */
  validationKey?: string;
  /** The content. */
  children: ReactNode;
}

/**
 * What a dialog implementation receives.
 *
 * The content must stay **mounted while closed**, in one parent that never
 * changes: an unmounted dialog validates nothing, and moving the content
 * between an inline parent and a portal remounts it.
 *
 * @group Implementations
 */
export interface DialogRenderProps {
  /** Show it. */
  open: boolean;
  /**
   * Design mode: draw the content in place, with no portal and no chrome.
   * Decided by the boundary, so no implementation has to know design mode.
   */
  inline: boolean;
  /** The heading. */
  title?: ReactNode;
  /** The content, already scoped. Always rendered. */
  content: ReactNode;
  /** A rule inside has a published error. */
  invalid: boolean;
  /** Call when the user dismisses it. */
  onClose(): void;
  /** Hide it entirely, without unmounting. */
  hidden: boolean;
  /** The dialog. */
  className?: ClassValue;
}

/**
 * What a dialog boundary draws with.
 *
 * @group Extensions
 */
export type DialogImplSource = ComponentType<DialogRenderProps> | RegistrySlot;

/**
 * Build a dialog component.
 *
 * @group Extensions
 */
export function dialogRenderer(
  source: DialogImplSource,
): ComponentType<DialogProps> {
  function DialogBoundary(props: DialogProps): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const open = getProp(rc, props.open) ?? false;
    const inline = scope.designMode;
    // Closed is `silent`: the content validates, and clearHidden leaves it.
    const presence: Presence = open || inline ? "rendered" : "silent";
    const validation = useChildValidationScope(
      useValidationScope(),
      "dialog",
      props.validationKey,
    );
    const contentScope = useMemo(
      () => narrowScope(scope, { presence: () => presence }),
      [scope, presence],
    );
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: DialogRenderProps = {
      open,
      inline,
      title: getProp(rc, props.title),
      invalid: !validation.isValid(rc),
      onClose: () => props.onClose?.(),
      hidden: scope.presence(rc) !== "rendered",
      className: getProp(rc, props.className),
      content: panel(contentScope, validation, props.children),
    };
    return rendered(<Impl {...renderProps} />);
  }
  DialogBoundary.displayName = boundaryName(
    "DialogBoundary",
    source as ComponentType<never>,
  );
  return DialogBoundary;
}
