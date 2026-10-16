import { Switch } from "react-native";
import type { ReactNode } from "react";
import type { Rendered } from "@rx-controls/react";
import { RichText, type DisplayOnlyExtra, type FieldOption } from "@rx-controls/forms-react";
import {
  fieldRenderer,
  useCheckbox,
  useFieldShell,
  type FieldRenderProps,
} from "@rx-controls/forms-react";
import {
  DefaultSchemaInterface,
  defaultTranslators,
  type LoaderOptions,
  type Translator,
} from "@rx-controls/forms-json";


/**
 * The playground standing in for ServiceTas's host on a device: the corpus's own stand-in host
 * (`rxc-forms-corpus/host`) draws DOM, so what a device needs of it is here — ServiceTas's
 * `Switch` render type, a boolean drawn as React Native's `Switch`.
 */
function SwitchImpl(p: FieldRenderProps<boolean | undefined | null>): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  return ctl.rendered(
    <Shell
      id={p.id}
      label={p.label}
      surface="custom"
      required={p.required}
      disabled={ctl.state.disabled}
      helpText={p.helpText}
      helpPlacement={p.helpPlacement}
      helpLabel={p.helpLabel}
      error={p.error}
      look={p.look}
      style={p.shellStyle}
    >
      <Switch
        accessibilityLabel={typeof p.label === "string" ? p.label : undefined}
        value={ctl.checked}
        disabled={locked}
        onValueChange={ctl.setChecked}
        onBlur={ctl.onBlur}
        trackColor={{ true: "#267151", false: "#d1d5db" }}
      />
    </Shell>,
  );
}
const SwitchField = fieldRenderer<boolean | undefined | null>(SwitchImpl);

type Options = { type?: string; [k: string]: unknown };
const ro = (d: object) => (d as { renderOptions?: unknown }).renderOptions as Options | null | undefined;

const switchTranslator: Translator = {
  match: (d, s) => d.type === "Data" && s?.type === "Bool" && ro(d)?.type === "Switch",
  renderTypes: ["Switch"],
  render: ({ props }) => <SwitchField {...(props as any)} />,
};

const text = (o: object, k: string) => (o as Record<string, unknown>)[k] as string | undefined;

/** Through the display-only slot, but an ordinary field: legacy's are data renderers, cleared when hidden. */
const ReadOnlyData = fieldRenderer<unknown, DisplayOnlyExtra>({ key: "displayOnly" });

/** ServiceTas's `HtmlRenderer`: a string field's value drawn as html (its words, on a device). */
const htmlRendererTranslator: Translator = {
  match: (d) => d.type === "Data" && ro(d)?.type === "HtmlRenderer",
  renderTypes: ["HtmlRenderer"],
  render: ({ props }) => (
    <ReadOnlyData
      {...(props as any)}
      required={undefined}
      text={(rc: { getValue: (c: any) => unknown }) => {
        const v = rc.getValue(props.field);
        return v == null || v === "" ? undefined : <RichText html={String(v)} />;
      }}
    />
  ),
};

/** ServiceTas's `CopyableData`: the value beside its title; the copy button is the app's. */
const copyableDataTranslator: Translator = {
  match: (d) => d.type === "Data" && ro(d)?.type === "CopyableData",
  renderTypes: ["CopyableData"],
  render: ({ props }) => <ReadOnlyData {...(props as any)} required={undefined} />,
};

type SchemaField = Parameters<DefaultSchemaInterface["textValue"]>[0];

/** ServiceTas's `formattedDateString`: `dd/mm/yyyy`, in Hobart. */
const dateFormat = new Intl.DateTimeFormat("en-AU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Australia/Hobart",
});

/** ServiceTas's `DynamicOptionsSchemaInterface.textValue`: a date or date-time as the app writes it. */
class ServiceTasSchemaInterface extends DefaultSchemaInterface {
  textValue(
    field: SchemaField,
    value: unknown,
    element?: boolean,
    options?: readonly FieldOption[] | null,
  ): string | undefined {
    const one = !field.collection || element;
    const named = (options ?? field.options ?? []).some((o: { value: unknown }) => o.value === value);
    if (one && !named && value && typeof value === "string") {
      if (field.type === "Date") return dateFormat.format(new Date(value));
      if (field.type === "DateTime") return dateFormat.format(new Date(this.parseToMillis(field, value)));
    }
    return super.textValue(field, value, element, options);
  }
}

export const nativeStandInHost: Pick<LoaderOptions, "translators" | "adornments" | "schemaInterface"> = {
  schemaInterface: new ServiceTasSchemaInterface(),
  translators: [switchTranslator, htmlRendererTranslator, copyableDataTranslator, ...defaultTranslators],
  adornments: {
    // ServiceTas's help renderer: a trigger at the label's end, `helpLabel` the words on it.
    HelpText: {
      props: (a, props, def) =>
        def.type === "Data"
          ? {
              ...props,
              helpText: (<RichText html={text(a, "helpText") ?? ""} />) as ReactNode,
              helpLabel: text(a, "helpLabel"),
              helpPlacement: [undefined, "LabelEnd"].includes(text(a, "placement")) ? ("labelEnd" as const) : undefined,
            }
          : undefined,
    },
  },
};
