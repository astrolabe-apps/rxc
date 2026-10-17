import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { Control } from "@rx-controls/core";
import { useReactive } from "@rx-controls/react";
import type { ReactNode } from "react";
import type { Rendered } from "@rx-controls/react";
import { Contents, RichText, type DisplayOnlyExtra, type FieldOption, type FormProp, type LookRef } from "@rx-controls/forms-react";
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

/**
 * ServiceTas's `CopyableData` (RNCopyableDataRenderer): the value and a copy icon, Font Awesome's
 * solid `copy`, which copies the value when pressed — the copying and its toast are the app's.
 * The icon is the field's end icon, beside the value's text rather than in it: a view inside a
 * Text is an object-replacement character in what Android reads. Through the display-only slot,
 * an ordinary field: legacy's is a data renderer.
 */
const copyableDataTranslator: Translator = {
  match: (d) => d.type === "Data" && ro(d)?.type === "CopyableData",
  renderTypes: ["CopyableData"],
  render: ({ props, def }) => {
    // Its colour is the value's (`text-[#002D6A]` on both in the corpus); its size the value's too.
    void text(ro(def) ?? {}, "iconClassName");
    void text(ro(def) ?? {}, "popupText");
    return <ReadOnlyData {...(props as any)} required={undefined} endIcon={{ family: "fa-solid", name: "copy" }} />;
  },
};

/**
 * ServiceTas's `Chart` render type, its one chart (RNChartRenderer's DoughnutChart): a ring
 * over the compound's `activePoints` of `totalPoints`, the points in its middle, drawn through
 * the field's look (its size, and the number's type) — without the app's animation.
 */
function Doughnut(p: { field: Control<unknown>; look?: FormProp<LookRef | undefined>; ringColor?: string; ringBackgroundColor?: string; displayText: boolean }) {
  const { rc, rendered } = useReactive();
  const fields = (p.field as Control<Record<string, unknown>>).fields;
  const progress = Number(rc.getValue(fields.activePoints) ?? 0) || 0;
  const total = Number(rc.getValue(fields.totalPoints) ?? 0) || 0;
  const offset = total ? (1 - progress / total) * 100 : 100;
  return rendered(
    <Contents look={p.look}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 40 40" transform={[{ rotate: "90deg" }, { scaleX: -1 }]}>
        <Circle cx="50%" cy="50%" r="16" fill="transparent" stroke={p.ringBackgroundColor ?? "#d2d3d4"} strokeWidth={5} />
        {progress > 0 && (
          <Circle cx="50%" cy="50%" r="16" fill="transparent" stroke={p.ringColor} strokeWidth={5} strokeDasharray="100" strokeDashoffset={offset} strokeLinecap="round" />
        )}
      </Svg>
      {p.displayText ? String(Math.round(progress)) : null}
    </Contents>,
  );
}

const chartTranslator: Translator = {
  match: (d) => d.type === "Data" && ro(d)?.type === "Chart",
  renderTypes: ["Chart"],
  render: ({ props, def }) => {
    const o = ro(def) ?? {};
    return o.chartType === "Doughnut" ? (
      <Doughnut
        field={props.field}
        look={props.look}
        ringColor={text(o, "ringColor")}
        ringBackgroundColor={text(o, "ringBackgroundColor")}
        displayText={o.displayText === true}
      />
    ) : null;
  },
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
  translators: [switchTranslator, htmlRendererTranslator, copyableDataTranslator, chartTranslator, ...defaultTranslators],
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
