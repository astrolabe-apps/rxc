import { useMemo, type ReactNode } from "react";
import type { Control, ControlContext } from "@rx-controls/core";
import { useControlContext, type Rendered } from "@rx-controls/react";
import type { ControlDefinition, SchemaField } from "@rx-controls/forms-schema";
import type {
  ActionHandler,
  AdornmentTranslator,
  DisplayTranslator,
  IconTranslator,
  Translator,
} from "./translator.js";
import { translateForm as translateTree } from "./translate.js";


/**
 * What kind of thing the loader could not carry across.
 *
 * - `control` — no translator matched the definition.
 * - `renderOptions` — a translator matched, but not this render type or group kind.
 * - `adornment` — no translator for the adornment, or the host's declined it.
 * - `dynamic` — a dynamic property nothing reads.
 * - `validator` — a validator type the loader has no implementation of.
 * - `expression` — an expression that does not compile, or a reference that does not resolve.
 * - `schema` — the definition names a field the schema does not have: a gap in the input, not the loader.
 * - `unread` — a property on the definition that nothing ever read.
 * - `action` — an action id no handler claimed: the button renders and does nothing.
 *
 * @group Loading
 */
export type LoaderWarningKind =
  | "control"
  | "renderOptions"
  | "adornment"
  | "dynamic"
  | "validator"
  | "expression"
  | "schema"
  | "unread"
  | "action";

/**
 * One thing the loader could not carry across.
 *
 * **Returned, not logged.** What a gap means is the host's decision: a list
 * can be rendered beside the control it is about, asserted on in a test, or
 * turned into a build failure over a corpus of forms — a console warning can
 * be none of those.
 *
 * @group Loading
 */
export interface LoaderWarning {
  /**
   * The definition's position in the tree, such as `"3.1.0"` — also the React
   * key of what it translated to, so a warning lines up with what rendered.
   */
  path: string;
  /** What kind of gap. */
  kind: LoaderWarningKind;
  /** The definition's title or bound field, for a person reading the list. */
  subject?: string;
  /** What was lost. */
  detail: string;
}

/**
 * Thrown by a `strict` translation that produced any warning.
 *
 * @group Loading
 */
export class LoaderStrictError extends Error {
  /** Every warning the translation produced. */
  readonly warnings: readonly LoaderWarning[];

  /** @param warnings - every warning the translation produced */
  constructor(warnings: readonly LoaderWarning[]) {
    super(`${warnings.length} loader warning(s)`);
    this.warnings = warnings;
  }
}

/**
 * How a host extends and configures the loader.
 *
 * @group Loading
 */
export interface LoaderOptions {
  /**
   * The translators to ask, in order. Default {@link defaultTranslators}; a
   * host passes its own followed by those.
   */
  translators?: readonly Translator[];
  /** Keyed by adornment `type`. An entry shadows the loader's own handling of that type. */
  adornments?: Record<string, AdornmentTranslator>;
  /** Keyed by a custom display's `customId`. */
  displays?: Record<string, DisplayTranslator>;
  /** Draws every icon the format names. */
  icon?: IconTranslator;
  /** What to render for a definition no translator matched. Default: a placeholder naming it. */
  onUnsupported?: (def: ControlDefinition) => ReactNode;
  /** Pairs each button's id and payload with host code. */
  actionHandler?: ActionHandler;
  /**
   * Throw a {@link LoaderStrictError} when the translation produces any
   * warning. The policy for CI over a corpus of forms: zero warnings, or the
   * build fails.
   */
  strict?: boolean;
}

/**
 * What {@link translateForm} returns.
 *
 * @group Loading
 */
export interface TranslateResult {
  /** The form, one node per top-level definition. */
  tree: ReactNode[];
  /** Everything that could not be carried across. */
  warnings: LoaderWarning[];
}

/**
 * Translate a form without mounting it. Translation allocates — an
 * asynchronous expression evaluates into a control and subscribes to the data
 * — so call it once per form and keep the result, as {@link JsonForm} does.
 *
 * @group Loading
 */
export function translateForm(
  ctx: ControlContext,
  data: Control<unknown>,
  schema: SchemaField[],
  controls: ControlDefinition[],
  options?: LoaderOptions,
): TranslateResult {
  const result = translateTree(ctx, data, schema, controls, options ?? {});
  if (options?.strict && result.warnings.length)
    throw new LoaderStrictError(result.warnings);
  return result;
}

/**
 * The props of {@link JsonForm}.
 *
 * @group Loading
 */
export interface JsonFormProps<T> extends LoaderOptions {
  /** The form definition. */
  controls: ControlDefinition[];
  /** The schema its fields bind against. */
  schema: SchemaField[];
  /** The data. */
  data: Control<T>;
  /**
   * Render the warnings, if there are any. Absent, they are dropped — a choice
   * the host has made, not a silence the loader imposed.
   */
  renderWarnings?: (warnings: LoaderWarning[]) => ReactNode;
}

/**
 * JSON in, ordinary JSX out. What it renders is what a JSX author would have
 * written — the same boundaries, the same scope, the same registry — so it
 * composes with hand-written form source in one tree. Translates once per
 * change of `controls`, `schema` or `data`, not per render.
 *
 * @group Loading
 */
export function JsonForm<T>({
  controls,
  schema,
  data,
  renderWarnings,
  ...options
}: JsonFormProps<T>): Rendered {
  const ctx = useControlContext();
  // Memoised because translation allocates: an asynchronous expression
  // evaluates into a control and subscribes to the data. The warnings ride
  // the same memo, so they are produced once per translation, not per render.
  const { tree, warnings } = useMemo(
    () =>
      translateForm(ctx, data as Control<unknown>, schema, controls, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, controls, schema, data],
  );
  return (
    <>
      {warnings.length > 0 && renderWarnings?.(warnings)}
      {tree}
    </>
  ) as Rendered;
}
