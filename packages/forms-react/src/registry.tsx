import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";
import type { ActionRenderProps } from "./action.js";
import type { CollectionRenderProps } from "./collection.js";
import type {
  DialogRenderProps,
  TabsRenderProps,
  WizardRenderProps,
} from "./containers.js";
import type {
  HtmlDisplayRenderProps,
  IconDisplayRenderProps,
  TextDisplayRenderProps,
} from "./display.js";
import type { GroupRenderProps } from "./group.js";
import type {
  FieldShellProps,
  InputFrameProps,
  VisibilityProps,
} from "./primitives.js";
import type {
  CheckboxRenderProps,
  DisplayOnlyRenderProps,
  RadioRenderProps,
  CheckListRenderProps,
  SelectRenderProps,
  TextFieldRenderProps,
} from "./widgets.js";

/**
 * An implementation: one component per built-in, plus the structural
 * primitives other renderers reuse. Closed and exhaustive — an implementation
 * fills every slot, so a built-in never falls back to something that is not
 * there.
 *
 * `forms-html`, `forms-mui` and `forms-antd` each export one. An app swaps a
 * slot by spreading: `{ ...htmlRenderers, visibility: MyVisibility }`.
 *
 * @group Implementations
 */
export interface FormRenderers {
  /** The implementation's name, for error messages. */
  name: string;
  /** {@link TextField}. */
  textfield: ComponentType<TextFieldRenderProps>;
  /** {@link CheckboxField}. */
  checkbox: ComponentType<CheckboxRenderProps>;
  /** {@link SelectField}. */
  select: ComponentType<SelectRenderProps>;
  /** {@link RadioField}. */
  radio: ComponentType<RadioRenderProps>;
  /** {@link CheckListField}. */
  checkList: ComponentType<CheckListRenderProps>;
  /** {@link DisplayOnlyField}. */
  displayOnly: ComponentType<DisplayOnlyRenderProps>;
  /** Every button: {@link Action}, and the ones other renderers draw. */
  action: ComponentType<ActionRenderProps>;
  /** {@link TextDisplay}. */
  text: ComponentType<TextDisplayRenderProps>;
  /** {@link HtmlDisplay}. */
  html: ComponentType<HtmlDisplayRenderProps>;
  /** {@link IconDisplay}. */
  icon: ComponentType<IconDisplayRenderProps>;
  /** {@link Contents} and {@link Section}: the standard group. */
  contents: ComponentType<GroupRenderProps>;
  /** {@link InlineGroup}: a bare inline element whose children are prose. */
  inline: ComponentType<GroupRenderProps>;
  /** {@link Tabs}. */
  tabs: ComponentType<TabsRenderProps>;
  /** {@link Wizard}. */
  wizard: ComponentType<WizardRenderProps>;
  /** {@link Dialog}. */
  dialog: ComponentType<DialogRenderProps>;
  /** {@link Elements}: the chrome-less collection. */
  elements: ComponentType<CollectionRenderProps<any>>;
  /** The field shell, reused by every field. */
  fieldShell: ComponentType<FieldShellProps>;
  /** The input frame, reused by every text-like control. */
  inputFrame: ComponentType<InputFrameProps>;
  /** Mount lifetime of what a boundary renders — where exit transitions live. */
  visibility: ComponentType<VisibilityProps>;
  /**
   * The implementation's own root, if it needs one — a library's theme or
   * config provider. {@link FormProvider} mounts it, so an app need not know
   * which library wants what.
   */
  root?: ComponentType<{
    /** Everything under the {@link FormProvider}. */
    children: ReactNode;
  }>;
  /**
   * The element a {@link Form} with an `onSubmit` wraps its content in, if the
   * platform has one — html's `<form>`, which is what lets Enter in a field
   * submit. Absent, a form submits only through its `submit` actions.
   */
  form?: ComponentType<FormElementProps>;
}

/**
 * What the `form` slot receives.
 *
 * @group Implementations
 */
export interface FormElementProps {
  /**
   * Submit the form: its `check()`, then its `onSubmit`. Call it from the
   * element's own submit event — a single-field form submitting on Enter, a
   * `requestSubmit()` — and always stop the platform's native submission.
   */
  onSubmit(): void;
  /** The form's content. Add no layout around it. */
  children: ReactNode;
}

/**
 * Draw with the active implementation's component for a slot, rather than a
 * fixed one — which is what lets `FormProvider` swap it.
 *
 * @group Extensions
 */
export interface RegistrySlot {
  /** The slot. */
  key: keyof FormRenderers;
}

/**
 * The props of {@link FormProvider}.
 *
 * @group Authoring
 */
export interface FormProviderProps {
  /** The implementation every form below draws with. */
  renderers: FormRenderers;
  /** The app, or the part of it that renders forms. */
  children: ReactNode;
}

/**
 * Selects the implementation for everything below. Sits at the app root and
 * is about the app, not any one form; mounts the implementation's `root` when
 * it declares one.
 *
 * @group Authoring
 */
export function FormProvider({
  renderers,
  children,
}: FormProviderProps): ReactNode {
  const Root = renderers.root;
  return (
    <RenderersContext.Provider value={renderers}>
      {Root ? <Root>{children}</Root> : children}
    </RenderersContext.Provider>
  );
}

const RenderersContext = createContext<FormRenderers | null>(null);

/** The active implementation, or `null` — for `Form`, which needs none. */
export function useRenderersIfAny(): FormRenderers | null {
  return useContext(RenderersContext);
}

/**
 * The active implementation. Throws when there is no {@link FormProvider}
 * above.
 *
 * @group Extensions
 */
export function useRenderers(): FormRenderers {
  const r = useContext(RenderersContext);
  if (!r)
    throw new Error(
      "No form implementation: wrap the app in <FormProvider renderers={…}>.",
    );
  return r;
}
