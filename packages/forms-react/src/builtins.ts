import type { ComponentType } from "react";
import type { Rendered } from "@rx-controls/react";
import type { ActionProps } from "./action.js";
import type { CollectionProps } from "./collection.js";
import type { DialogProps, TabsProps, WizardProps } from "./containers.js";
import type {
  DisplayProps,
  HtmlDisplayExtra,
  IconDisplayExtra,
  TextDisplayExtra,
} from "./display.js";
import type { FieldProps } from "./field.js";
import type { GroupProps } from "./group.js";
import type {
  DisplayOnlyExtra,
  OptionValue,
  RadioExtra,
  SelectExtra,
  TextFieldExtra,
} from "./widgets.js";
import { actionRenderer } from "./action.js";
import { collectionRenderer } from "./collection.js";
import { dialogRenderer, tabsRenderer, wizardRenderer } from "./containers.js";
import { displayRenderer } from "./display.js";
import { fieldRenderer } from "./field.js";
import { groupRenderer } from "./group.js";
import { getProp } from "./props.js";

/*
 * The built-ins. Each is a boundary over a registry slot, so
 * `<FormProvider renderers>` decides what draws it. The field built-ins are
 * generic in their value type: a schema can yield `string`, `string |
 * undefined` or `string | null` for the same widget.
 */

/**
 * A text input.
 *
 * @group Authoring
 */
export const TextField: <T extends string | undefined | null>(
  props: FieldProps<T> & TextFieldExtra,
) => Rendered = fieldRenderer<string | undefined | null, TextFieldExtra>(
  { key: "textfield" },
  {
    rules: (p) =>
      p.maxLength === undefined
        ? undefined
        : {
            maxLength: (v, rc) => {
              const max = getProp(rc, p.maxLength);
              return max !== undefined && v != null && v.length > max
                ? `At most ${max} characters`
                : null;
            },
          },
  },
) as never;

/**
 * A checkbox. It labels itself.
 *
 * @group Authoring
 */
export const CheckboxField: <T extends boolean | undefined | null>(
  props: FieldProps<T>,
) => Rendered = fieldRenderer<boolean | undefined | null>({ key: "checkbox" }) as never;

/**
 * A choice from a list.
 *
 * @group Authoring
 */
export const SelectField: <T extends OptionValue>(
  props: FieldProps<T> & SelectExtra,
) => Rendered = fieldRenderer<OptionValue, SelectExtra>({ key: "select" }) as never;

/**
 * A choice from a list, as radio buttons, with optional content per option.
 *
 * @group Authoring
 */
export const RadioField: <T extends OptionValue>(
  props: FieldProps<T> & RadioExtra,
) => Rendered = fieldRenderer<OptionValue, RadioExtra>({ key: "radio" }) as never;

/**
 * A bound value shown as text and never edited.
 *
 * **Write-free**: it never clears the data it shows when hidden and never
 * applies a default, whatever the form's `clearHidden` says. A read-only view
 * of a value some other field owns must not be able to change it. `required`
 * means nothing on it.
 *
 * @group Authoring
 */
export const DisplayOnlyField: <T>(
  props: FieldProps<T> & DisplayOnlyExtra,
) => Rendered = fieldRenderer<unknown, DisplayOnlyExtra>(
  { key: "displayOnly" },
  { writes: false },
) as never;

/**
 * The chrome-less collection: its rows, with nothing drawn around them.
 *
 * @group Authoring
 */
export const Elements: <T>(props: CollectionProps<T>) => Rendered =
  collectionRenderer<unknown>({ key: "elements" }) as never;

/**
 * The standard group: a region with an optional title, which narrows the scope
 * for what is inside. `<Contents hidden={…}>` is how a region is hidden.
 *
 * @group Authoring
 */
export const Contents: ComponentType<GroupProps> =
  groupRenderer({ key: "contents" });

/**
 * {@link Contents} with a validation scope: the implementation is told when
 * anything inside is invalid, for a header that shows a marker.
 *
 * @group Authoring
 */
export const Section: ComponentType<GroupProps> =
  groupRenderer({ key: "contents" }, { scope: true });

/**
 * A group whose children are prose: fields and displays inside draw a bare
 * inline element, with no shell.
 *
 * @group Authoring
 */
export const InlineGroup: ComponentType<GroupProps> =
  groupRenderer({ key: "inline" }, { inline: true });

/**
 * A tab strip.
 *
 * @group Authoring
 */
export const Tabs: ComponentType<TabsProps> =
  tabsRenderer({ key: "tabs" });

/**
 * A multi-page form with Next and Back, whose Next waits for the page's
 * validators and refuses while it is invalid.
 *
 * @group Authoring
 */
export const Wizard: ComponentType<WizardProps> =
  wizardRenderer({ key: "wizard" });

/**
 * A modal dialog. Closed is `silent`; in design mode it draws inline.
 *
 * @group Authoring
 */
export const Dialog: ComponentType<DialogProps> =
  dialogRenderer({ key: "dialog" });

/**
 * A button.
 *
 * @group Authoring
 */
export const Action: ComponentType<ActionProps> =
  actionRenderer({ key: "action" });

/**
 * Static text.
 *
 * @group Authoring
 */
export const TextDisplay: ComponentType<DisplayProps & TextDisplayExtra> =
  displayRenderer<TextDisplayExtra>({ key: "text" });

/**
 * Static markup.
 *
 * @group Authoring
 */
export const HtmlDisplay: ComponentType<DisplayProps & HtmlDisplayExtra> =
  displayRenderer<HtmlDisplayExtra>({ key: "html" });

/**
 * A static icon. Give it an `accessibleName`: it has no text of its own.
 *
 * @group Authoring
 */
export const IconDisplay: ComponentType<DisplayProps & IconDisplayExtra> =
  displayRenderer<IconDisplayExtra>({ key: "icon" });
