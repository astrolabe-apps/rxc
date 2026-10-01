import {
  useEffect,
  useMemo,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";
import type { Control, ReadContext } from "@rx-controls/core";
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
 * One panel's content: its scope — `rendered` when shown, `silent` when not,
 * `hidden` when its item is — and its validation scope, around the author's
 * children. Memoised on what it depends on, so a strip re-rendering does not
 * hand every panel a new scope object.
 */
function usePanels(
  scope: ScopeState,
  keys: string[],
  shown: (key: string) => boolean,
  hidden: (FormProp<boolean | undefined> | undefined)[],
  scopes: Map<string, ValidationScopeImpl>,
): Map<string, ScopeState> {
  const signature = JSON.stringify(keys.map((k) => [k, shown(k)]));
  const hiddenProps = useStableList(hidden);
  return useMemo(() => {
    const m = new Map<string, ScopeState>();
    (JSON.parse(signature) as [string, boolean][]).forEach(([k, on], i) => {
      const h = hiddenProps[i];
      // `undefined` — an expression still pending — shows, as a group's does.
      const presence = (rc: ReadContext): Presence =>
        getProp(rc, h) === true ? "hidden" : on ? "rendered" : "silent";
      m.set(k, narrowScope(scope, { presence }));
    });
    return m;
    // `scopes` is keyed the same way; its identity follows `keys`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, signature, hiddenProps, scopes]);
}

/**
 * The same array as last render when every element is the same — so a list
 * of props rebuilt each render keys a memo only when one of them moved.
 */
function useStableList<T>(list: T[]): T[] {
  const last = useRef(list);
  const prev = last.current;
  if (prev.length !== list.length || list.some((x, i) => x !== prev[i]))
    last.current = list;
  return last.current;
}

/** An item's `hidden`, resolved: only `true` hides — pending shows. */
function itemHidden(
  rc: ReadContext,
  item: { hidden?: FormProp<boolean | undefined> },
): boolean {
  return getProp(rc, item.hidden) === true;
}

/**
 * Leaving a panel touches it, the way leaving a field touches that: when
 * `current` moves on from a value, `leave` runs with the one it left. From an
 * effect, so a page index moved by the data rather than a click counts too,
 * and the first render — nothing left yet — does nothing. Not while `locked`:
 * a read-only or disabled region has nothing for the user to fix, and design
 * mode shows everything at once.
 */
function useTouchOnLeave<K>(
  current: K,
  leave: (left: K) => void,
  locked: boolean,
) {
  const last = useRef(current);
  useEffect(() => {
    const left = last.current;
    last.current = current;
    if (left !== current && !locked) leave(left);
  }, [current, leave, locked]);
}

/** Locked for {@link useTouchOnLeave}: read-only, disabled or design mode. */
function lockedHere(scope: ScopeState, rc: ReadContext): boolean {
  return scope.designMode || scope.disabled(rc) || scope.readOnly(rc);
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
  /**
   * Hide the tab: off the strip, and its panel `hidden` — mounted, but its
   * fields stop validating and `clearHidden` applies, as under a hidden
   * group. `undefined` from a resolved prop is pending, and shows. A hidden
   * active tab hands over to the first shown one.
   */
  hidden?: FormProp<boolean | undefined>;
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
  /** The active panel — or every shown panel, in design mode. */
  active: boolean;
  /**
   * The tab is hidden: draw no tab for it, and keep its panel mounted and
   * off screen, like any inactive one. Never `active`.
   */
  hidden: boolean;
  /**
   * A touched field in this panel is showing an error — see
   * {@link ValidationScope.showingErrors}. Leaving a tab touches it, so a tab
   * left unfinished is marked while its errors are off screen.
   */
  invalid: boolean;
}

/**
 * What a tab-strip implementation receives.
 *
 * **Every panel must be mounted, always** — a hidden item's too — and an
 * inactive one hidden with a style or the `hidden` attribute, in a parent
 * that does not change when its item hides. A panel that never mounted registers
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

    const hiddenAt = items.map((i) => itemHidden(rc, i));
    const shownItems = items.filter((_, i) => !hiddenAt[i]);
    const active = useControl(items[0]?.key ?? "");
    const stored = rc.getValue(active);
    // A hidden or unknown tab is never the active one: the first shown tab
    // stands in, in this very render, and the effect below makes it stick.
    const activeKey = shownItems.some((i) => i.key === stored)
      ? stored
      : (shownItems[0]?.key ?? stored);
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
      items.map((i) => i.hidden),
      scopes,
    );

    useTouchOnLeave(
      activeKey,
      (left) => scopes.get(left)?.touchAll(),
      lockedHere(scope, rc),
    );

    useEffect(() => {
      if (activeKey !== stored) update((wc) => wc.setValue(active, activeKey));
    }, [activeKey, stored, active, update]);

    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: TabsRenderProps = {
      items: items.map((item, i) => ({
        key: item.key,
        title: item.title,
        active: !hiddenAt[i] && (stacked || item.key === activeKey),
        hidden: hiddenAt[i],
        invalid: scopes.get(item.key)!.showingErrors(rc),
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
  /**
   * Hide the page: out of the step sequence — Next and Back skip it — and
   * `hidden` like a hidden group's content, mounted but not validating, with
   * `clearHidden` applying. `undefined` is pending, and shows. If the current
   * page hides, the wizard moves to the next shown page, or else the
   * previous one.
   */
  hidden?: FormProp<boolean | undefined>;
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
  /** The current page — or every shown page, in design mode. */
  active: boolean;
  /**
   * The page is hidden: no step for it, its page mounted and off screen.
   * Never `active`. Number the steps over the shown pages.
   */
  hidden: boolean;
  /**
   * A touched field on this page is showing an error — see
   * {@link ValidationScope.showingErrors}. Leaving a page touches it, and so
   * does a refused Next.
   */
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
  /** The current page, as an index into `items` — never a hidden one. */
  index: number;
  /** There is a shown page before this one. */
  canBack: boolean;
  /** There is a shown page after this one. */
  canNext: boolean;
  /**
   * The page's {@link ValidationScope.check}, then advance if it passed: wait
   * for the page's asynchronous validators, and if a rule on the page fails,
   * touch the page so its errors show and stay. Returns the promise, so a
   * button drawing it shows busy.
   */
  next(): Promise<void>;
  /** Go back to the previous shown page. */
  back(): void;
  /** Go to a page, by index into `items`. Does nothing for a hidden one. */
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
    const hiddenAt = items.map((i) => itemHidden(rc, i));
    const after = (from: number) => {
      for (let j = from + 1; j < items.length; j++) if (!hiddenAt[j]) return j;
    };
    const before = (from: number) => {
      for (let j = from - 1; j >= 0; j--) if (!hiddenAt[j]) return j;
    };
    const raw = Math.min(
      Math.max(rc.getValue(indexControl) ?? 0, 0),
      Math.max(items.length - 1, 0),
    );
    // Never a hidden page: the next shown one stands in, else the previous —
    // in this render, and the effect below makes it stick.
    const index = hiddenAt[raw] ? (after(raw) ?? before(raw) ?? raw) : raw;
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
      items.map((i) => i.hidden),
      scopes,
    );
    const goTo = (i: number | undefined) => {
      if (i === undefined || i < 0 || i >= items.length || hiddenAt[i]) return;
      update((wc) => wc.setValue(indexControl, i));
    };
    useEffect(() => {
      if (index !== raw) update((wc) => wc.setValue(indexControl, index));
    }, [index, raw, indexControl, update]);

    useTouchOnLeave(
      index,
      (left) => {
        const k = keys[left];
        if (k !== undefined) scopes.get(k)?.touchAll();
      },
      lockedHere(scope, rc),
    );

    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: WizardRenderProps = {
      items: items.map((item, i) => ({
        key: item.key,
        title: item.title,
        active: !hiddenAt[i] && (stacked || i === index),
        hidden: hiddenAt[i],
        visited: i <= index,
        invalid: scopes.get(item.key)!.showingErrors(rc),
        content: panel(panels.get(item.key)!, scopes.get(item.key)!, item.children),
      })),
      index,
      canBack: before(index) !== undefined,
      canNext: after(index) !== undefined,
      // The page's gate — the same `check()` a form's submit is.
      next: async () => {
        const current = items[index];
        if (current && (await scopes.get(current.key)!.check())) goTo(after(index));
      },
      back: () => goTo(before(index)),
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
  /**
   * A touched field inside is showing an error — see
   * {@link ValidationScope.showingErrors}. Closing the dialog touches its
   * content, so a trigger drawn beside it can show what was left unfinished.
   */
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
    // However it closes — dismissed, or the author's own control — closing
    // is leaving it.
    useTouchOnLeave(
      open,
      (wasOpen) => {
        if (wasOpen) validation.touchAll();
      },
      lockedHere(scope, rc),
    );
    const Impl = resolveImpl(source as ComponentType<never>, renderers);
    const renderProps: DialogRenderProps = {
      open,
      inline,
      title: getProp(rc, props.title),
      invalid: validation.showingErrors(rc),
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
