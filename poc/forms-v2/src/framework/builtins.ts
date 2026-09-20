import type { Rendered } from "@rx-controls/react";
import {
  collectionRenderer,
  fieldRenderer,
  groupRenderer,
} from "./boundary.js";
import { tabsRenderer } from "./tabs.js";
import { actionRenderer } from "./actions.js";
import { displayRenderer } from "./display.js";
import type {
  CollectionProps,
  FieldProps,
  HtmlDisplayExtra,
  OptionValue,
  SelectExtra,
  TextDisplayExtra,
  TextFieldExtra,
} from "./types.js";

/**
 * The one data built-in this POC carries. Resolved from the registry, so
 * `<FormProvider renderers>` swaps what draws it.
 *
 * The generic call signature is README finding 13: a boundary is produced for
 * one concrete `T`, but a schema legitimately yields `string`,
 * `string | undefined` or `string | null` for the same widget.
 */
export const TextField = fieldRenderer<
  string | undefined | null,
  TextFieldExtra
>({ key: "textfield" }) as unknown as <T extends string | undefined | null>(
  props: FieldProps<T> & TextFieldExtra,
) => Rendered;

/** The chrome-less group. What replaced `<Show>`. */
export const Contents = groupRenderer({ key: "contents" });

/**
 * The chrome-less collection — the array analogue of `<Contents>`, and what
 * `<Each>` turned into once it had to be a boundary.
 */
export const Elements = collectionRenderer({
  key: "elements",
}) as unknown as <T>(props: CollectionProps<T>) => Rendered;

/**
 * The widget that labels itself. Nothing in the contract changes for it: the
 * boundary hands `label` to the renderer as always, and this renderer simply
 * does not pass it on to the shell. Legacy needed a `hidesLabel` flag on the
 * registration to express that; flat props get it for free.
 */
export const CheckboxField = fieldRenderer<boolean | undefined | null>({
  key: "checkbox",
}) as unknown as <T extends boolean | undefined | null>(
  props: FieldProps<T>,
) => Rendered;

/** The container that sets `silent`. */
export const Tabs = tabsRenderer({ key: "tabs" });

/** The authored button. Composed ones go through `useAction(id)` instead. */
export const Action = actionRenderer({ key: "action" });

/** Static content. No binding, so no validators and nothing to clear. */
export const TextDisplay = displayRenderer<TextDisplayExtra>({ key: "text" });
export const HtmlDisplay = displayRenderer<HtmlDisplayExtra>({ key: "html" });

/** The options widget. `options` is a prop — the schema is loader-only. */
export const SelectField = fieldRenderer<OptionValue, SelectExtra>({
  key: "select",
}) as unknown as <T extends OptionValue>(
  props: FieldProps<T> & SelectExtra,
) => Rendered;
