import type { Rendered } from "@rx-controls/react";
import {
  collectionRenderer,
  fieldRenderer,
  groupRenderer,
} from "./boundary.js";
import { tabsRenderer } from "./tabs.js";
import { wizardRenderer } from "./wizard.js";
import { dialogRenderer } from "./dialog.js";
import { actionRenderer } from "./actions.js";
import { displayRenderer } from "./display.js";
import type {
  CollectionProps,
  DisplayOnlyExtra,
  FieldProps,
  HtmlDisplayExtra,
  IconDisplayExtra,
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
 * The same implementation, with a validation scope. Two boundaries from one
 * renderer, differing only in whether they aggregate their content's validity
 * — which is what `{ scope: true }` is: a property of the boundary, not of
 * the thing that draws it.
 */
export const Section = groupRenderer({ key: "contents" }, { scope: true });

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

/** The button — the author's, and every one another renderer draws. */
export const Action = actionRenderer({ key: "action" });

/** Static content. No binding, so no validators and nothing to clear. */
export const TextDisplay = displayRenderer<TextDisplayExtra>({ key: "text" });
export const HtmlDisplay = displayRenderer<HtmlDisplayExtra>({ key: "html" });
/**
 * The display whose content carries no meaning of its own, so
 * `accessibleName` is load-bearing here and nowhere else.
 */
export const IconDisplay = displayRenderer<IconDisplayExtra>({ key: "icon" });

/** The options widget. `options` is a prop — the schema is loader-only. */
export const SelectField = fieldRenderer<OptionValue, SelectExtra>({
  key: "select",
}) as unknown as <T extends OptionValue>(
  props: FieldProps<T> & SelectExtra,
) => Rendered;

/**
 * The value as text, never edited — a field boundary over a read-only widget,
 * and **write-free**: it never clears the data it shows when hidden, and would
 * never apply a default, whatever the form's `clearHidden` says. A read-only
 * view of a value owned by some other field must not be able to change it.
 *
 * An intentional divergence from legacy, whose clearHidden and defaultValue
 * cycles had no display-only exception (README finding 54): 76 of the
 * corpus's 375 DisplayOnly controls are hidden by an expression, and under a
 * clearHidden host each of those wipes the value it was summarising.
 * Generic in `T` like the others; the widget sees `unknown`.
 */
export const DisplayOnlyField = fieldRenderer<unknown, DisplayOnlyExtra>(
  { key: "displayOnly" },
  { writes: false },
) as unknown as <T>(props: FieldProps<T> & DisplayOnlyExtra) => Rendered;

/** A stateful container whose state may live in the data. */
export const Wizard = wizardRenderer({ key: "wizard" });

/** The portal container. Closed is `silent`; design mode renders it inline. */
export const Dialog = dialogRenderer({ key: "dialog" });
