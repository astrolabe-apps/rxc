import { Pressable, Text, View } from "react-native";
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
 * `Switch` render type, drawn as the app's own switch (`RNSwitchRenderer`, over
 * `@rn-primitives/switch`) rather than React Native's: a 48 × 28 track, the accent when on and
 * `#e4e4e7` when off, a 24 white thumb, half opacity while locked, and "On" / "Off" beside it
 * under `displayLabel`.
 */
const ACCENT = "#267151";
function SwitchImpl(p: FieldRenderProps<boolean | undefined | null> & { displayLabel?: boolean }): Rendered {
  const Shell = useFieldShell();
  const ctl = useCheckbox(p.field);
  const locked = ctl.state.disabled || ctl.state.readOnly;
  const on = !!ctl.checked;
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: locked ? 0.5 : 1 }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={typeof p.label === "string" ? p.label : undefined}
          accessibilityState={{ checked: on, disabled: locked }}
          aria-checked={on}
          disabled={locked}
          onPress={() => ctl.setChecked(!on)}
          onBlur={ctl.onBlur}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "transparent",
            backgroundColor: on ? ACCENT : "#e4e4e7",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#ffffff",
              transform: [{ translateX: on ? 20.5 : 1.5 }],
            }}
          />
        </Pressable>
        {p.displayLabel && (
          <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 17, lineHeight: 22, color: "#343534" }}>
            {on ? "On" : "Off"}
          </Text>
        )}
      </View>
    </Shell>,
  );
}
const SwitchField = fieldRenderer<boolean | undefined | null, { displayLabel?: boolean }>(SwitchImpl);

type Options = { type?: string; [k: string]: unknown };
const ro = (d: object) => (d as { renderOptions?: unknown }).renderOptions as Options | null | undefined;

const switchTranslator: Translator = {
  match: (d, s) => d.type === "Data" && s?.type === "Bool" && ro(d)?.type === "Switch",
  renderTypes: ["Switch"],
  render: ({ props, def }) => <SwitchField {...(props as any)} displayLabel={ro(def)?.displayLabel === true} />,
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

/**
 * ServiceTas's custom displays are each screen's own — the renewal screen's BPAY logo and
 * platform payment button, the MAST summaries' portal button, the wizards' "where can I find
 * this" pictures — passed to `AppForm` as `customDisplay`, which draws nothing for an id the
 * screen does not handle. The playground has no screens, so it draws nothing for any of them,
 * as the comparison harness does; the loader still reports each one it meets.
 */
const SCREEN_DISPLAYS = [
  "goToMASTPortalButton",
  "whereCanIFindThis",
  "PlatformPaymentButton",
  "payTo",
  "howToFindLicenceNumber",
  "image",
  "BPayLogo",
  "howToFindVIN",
  "PlatesPlusIcon",
  "TFSLogo",
  "FindServiceImage",
  "loadingSpinner",
  "icon",
  "howToFindRWVPNumber",
  "FaceVerifier",
];

export const nativeStandInHost: Pick<LoaderOptions, "translators" | "adornments" | "schemaInterface" | "displays"> = {
  schemaInterface: new ServiceTasSchemaInterface(),
  displays: Object.fromEntries(SCREEN_DISPLAYS.map((id) => [id, () => null])),
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
