import type { ComponentType, ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import type { ClassValue, FormProp } from "./props.js";
import type { RegistrySlot } from "./registry.js";
import { notBuiltComponent } from "./notBuilt.js";

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
  return notBuiltComponent("tabsRenderer");
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
  return notBuiltComponent("wizardRenderer");
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
  return notBuiltComponent("dialogRenderer");
}
