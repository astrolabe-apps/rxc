import type { ReactNode } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import type {
  ControlAdornment,
  ControlDefinition,
  IconReference,
  SchemaField,
} from "@rx-controls/forms-schema";
import type { FieldProps, FormProp } from "@rx-controls/forms-react";
import type { LoaderOptions } from "./loader.js";
import {
  CompoundCycle as CompoundCycleImpl,
  defaultTranslators as builtinTranslators,
} from "./translate.js";


/**
 * How {@link TranslateArgs.retranslate} rebuilds a definition's children:
 * where they bind, and what extra bindings their expressions see. Declarative,
 * so a translator never handles the loader's data cursor.
 *
 * The case it exists for is a radio's per-option content — the children
 * translated once per option, bound where the radio sits, with
 * `$formData.option` and `$formData.optionSelected` for their expressions.
 *
 * @group Hosts
 */
export interface RetranslateRebuild {
  /**
   * Where the children bind. `child` (the default): inside this definition's
   * field, as any child does. `own`: where this definition itself sits.
   */
  at?: "child" | "own";
  /** Extra bindings the children's jsonata expressions see, as `$name`. */
  variables?: {
    /**
     * Distinguishes this variant in the expression cache, which is per control
     * and expression: two variants over one control and one expression would
     * otherwise read each other's results. The option's value, say.
     */
    key: string;
    /**
     * The bindings. Read in the evaluator's own window, so a binding that
     * reads a control re-runs the expressions that use it.
     */
    values: (rc: ReadContext) => Record<string, unknown>;
  };
  /**
   * `false` for a repeat translation of children already translated once — a
   * second option's copy — or every gap is reported once per variant. Default
   * `true`.
   */
  collectWarnings?: boolean;
}

/**
 * What a translator is given for one definition.
 *
 * @group Hosts
 */
export interface TranslateArgs {
  /** The definition being translated. */
  def: ControlDefinition;
  /** The schema field it binds, if any. */
  schema?: SchemaField;
  /**
   * The props a JSX author would have written — label, flags, validators,
   * class slots, the binding itself — built by the loader. A translator never
   * binds a field of its own: one that did could register semantics below the
   * boundary, where an implementation could drop them.
   */
  props: FieldProps<any>;
  /** The definition's children, already translated. */
  children: ReactNode[];
  /**
   * The props built for each child, in the order of `children` — for a
   * container that takes structured items and needs a child's metadata on the
   * item, as Tabs puts a child's `hidden` on its tab. `undefined` for a child
   * that was not translated through the loader.
   */
  childProps: (FieldProps<any> | undefined)[];
  /** For a collection: the children, rendered against one element. */
  element?: (item: Control<any>, index: number) => ReactNode;
  /** For an action: the click the host's `actionHandler` resolved, if any. */
  onClick?: () => void | Promise<void>;
  /**
   * Translate the children again. `options` are merged over the loader's — a
   * dialog claims its own open and close ids for its subtree, with the
   * enclosing handler as the fall-through. `rebuild` says where the children
   * bind and what their expressions see.
   */
  retranslate: (
    options?: Partial<LoaderOptions>,
    rebuild?: RetranslateRebuild,
  ) => ReactNode[];
  /**
   * A `dynamic` entry of the given type, as a prop — for the ones that are not
   * field props, such as a display's `Display` override. A translator that
   * reads one lists its type in {@link Translator.dynamics}, or the loader
   * reports it dropped.
   */
  dynamicValue: (type: string) => FormProp<unknown> | undefined;
  /** How icons are drawn: the host's {@link LoaderOptions.icon}, or the default. */
  icon: IconTranslator;
}

/**
 * Turns a class of definitions into JSX. The loader asks each translator in
 * order and uses the first that matches, so a host's translators go before
 * {@link defaultTranslators}.
 *
 * @group Hosts
 */
export interface Translator {
  /** Does this translator handle `def`? */
  match(def: ControlDefinition, schema?: SchemaField): boolean;
  /** The JSX for `def`. */
  render(args: TranslateArgs): ReactNode;
  /**
   * The `renderOptions.type` / `groupOptions.type` values this translator
   * gives meaning to. Any other value on a definition it matched is reported
   * as one the loader fell back on — so `Radio` on a field only a text
   * translator matched is a warning, not a silent text input.
   */
  renderTypes?: string[];
  /** The `dynamic` property types it reads through {@link TranslateArgs.dynamicValue}. */
  dynamics?: string[];
  /**
   * It builds its children itself through {@link TranslateArgs.retranslate}.
   * The loader then skips translating them first, which would otherwise
   * translate and warn about every child twice.
   */
  ownsChildren?: boolean;
}

/**
 * How a button in a loaded form reaches host code. JSON cannot hold a closure,
 * so the format gives a button an id and a payload, and the host pairs them
 * here: asked once per button, it returns the click or `undefined` to decline.
 * An id nobody claims is a warning, not a button that silently does nothing.
 *
 * @group Hosts
 */
export type ActionHandler = (
  actionId: string,
  actionData: unknown,
) => (() => void | Promise<void>) | undefined;

/**
 * How a host gives meaning to an adornment type, or takes over one the loader
 * handles. An adornment decorates a control rather than replacing it, so it
 * has two optional phases; either may decline by returning `undefined`, and an
 * adornment nothing accepts is reported dropped.
 *
 * @group Hosts
 */
export interface AdornmentTranslator {
  /**
   * Before the control's translator runs: amend its props. A help adornment
   * with an extra label becomes whatever the host's shell reads.
   */
  props?: (
    adornment: ControlAdornment,
    props: FieldProps<any>,
    def: ControlDefinition,
  ) => FieldProps<any> | undefined;
  /** After: wrap what was translated — a highlight ring, a column's chrome. */
  wrap?: (
    adornment: ControlAdornment,
    node: ReactNode,
    def: ControlDefinition,
  ) => ReactNode | undefined;
}

/**
 * A custom display, addressed by its `customId`. Gets what any translator gets,
 * with `props` built, so `hidden` and the class slots stay the loader's job.
 *
 * @group Hosts
 */
export type DisplayTranslator = (args: TranslateArgs) => ReactNode;

/**
 * What draws an icon the format names. The default draws an `<i>` with the
 * icon library's classes, which renders wherever that library's CSS is
 * loaded; a host on another icon set maps the name here.
 *
 * @group Hosts
 */
export type IconTranslator = (
  icon: IconReference,
  className?: string,
) => ReactNode;

/**
 * The loader's own translators, in match order: every render type, group kind
 * and display the canonical format defines. A host prepends its own.
 *
 * @group Hosts
 */
export const defaultTranslators: readonly Translator[] = builtinTranslators;

/**
 * The props of {@link CompoundCycle}.
 *
 * @group Hosts
 */
export interface CompoundCycleProps {
  /** The compound's control. */
  control: Control<unknown>;
  /** Its default value. */
  value: FormProp<unknown> | undefined;
  /** Its `hidden`. */
  hidden: FormProp<boolean | undefined> | undefined;
  /** Its `dontClearHidden`. */
  dontClearHidden: boolean | undefined;
}

/**
 * The clear-when-hidden and default-when-shown cycle for a compound field
 * rendered as a group. A group binds nothing, so nothing else runs it; a host
 * translator that draws a compound as a group of its own mounts this inside
 * the group.
 *
 * @group Hosts
 */
export const CompoundCycle: (props: CompoundCycleProps) => null =
  CompoundCycleImpl;
