"use client";

import { useRef } from "react";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  compoundControl,
  ControlAdornmentType,
  ControlDefinitionType,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  dataExpr,
  DataRenderType,
  DisplayDataType,
  FieldType,
  GroupRenderType,
  groupedControl,
  htmlDisplayControl,
  IconLibrary,
  textDisplayControl,
  type AccordionAdornment,
  type CompoundField,
  type ControlAdornment,
  type ControlDefinition,
  type CustomDisplay,
  type DisplayControlDefinition,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type IconAdornment,
  type IconDisplay,
  type SchemaField,
  type SchemaTreeResolver,
  type SelectChildRenderer as SelectChildRenderOptions,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";
import type { HtmlFormOptions } from "@rxc/forms";
import type { ComponentType } from "react";
import type { DisplayData } from "@rxc/forms-core";

// ── Schema ───────────────────────────────────────────────────────────

function showcaseSchema(): SchemaField[] {
  return [
    { type: FieldType.String, field: "name" },
    { type: FieldType.String, field: "bio" },
    { type: FieldType.Bool, field: "subscribed" },
    { type: FieldType.Int, field: "age" },
    { type: FieldType.Double, field: "rating" },
    { type: FieldType.Date, field: "birthday" },
    { type: FieldType.DateTime, field: "lastLogin" },
    { type: FieldType.Time, field: "wakeAt" },
    {
      type: FieldType.String,
      field: "color",
      options: [
        { name: "Red", value: "red" },
        { name: "Green", value: "green" },
        { name: "Blue", value: "blue" },
      ],
    },
    {
      type: FieldType.String,
      field: "size",
      options: [
        { name: "Small", value: "S" },
        { name: "Medium", value: "M" },
        { name: "Large", value: "L" },
      ],
    },
    {
      type: FieldType.String,
      field: "tags",
      collection: true,
      options: [
        { name: "Featured", value: "featured" },
        { name: "Sale", value: "sale" },
        { name: "New", value: "new" },
        { name: "Limited", value: "limited" },
      ],
    },
    {
      type: FieldType.String,
      field: "country",
      options: [
        { name: "Australia", value: "AU" },
        { name: "Canada", value: "CA" },
        { name: "Germany", value: "DE" },
        { name: "Spain", value: "ES" },
        { name: "France", value: "FR" },
        { name: "United Kingdom", value: "GB" },
        { name: "United States", value: "US" },
      ],
    },
    { type: FieldType.String, field: "displayed" },
    {
      type: FieldType.Compound,
      field: "address",
      collection: true,
      children: [
        { type: FieldType.String, field: "street" },
        { type: FieldType.String, field: "city" },
        { type: FieldType.String, field: "zip" },
      ],
    } as CompoundField,
    // Pre-existing-gap fields
    { type: FieldType.String, field: "firstName" },
    { type: FieldType.String, field: "lastName" },
    { type: FieldType.String, field: "secret" },
    { type: FieldType.Int, field: "shownChildIndex" },
    { type: FieldType.String, field: "panelA" },
    { type: FieldType.String, field: "panelB" },
  ];
}

// ── Form definition ──────────────────────────────────────────────────

function showcaseFormDef(): GroupedControlsDefinition {
  const textDisplay: DisplayControlDefinition = textDisplayControl(
    "Below: kitchen sink for every default render type.",
  );
  const htmlDisplay: DisplayControlDefinition = htmlDisplayControl(
    '<em>Rendered via <code>HtmlDisplay</code></em>',
  );

  return groupedControl(
    [
      textDisplay,
      htmlDisplay,
      // Plain text (catch-all)
      dataControl("name", "Name", { required: true }),
      // Multiline
      {
        ...dataControl("bio", "Bio"),
        renderOptions: { type: DataRenderType.Textfield, multiline: true },
      } as ControlDefinition,
      // Bool default → checkbox absorbing label
      dataControl("subscribed", "Subscribed to newsletter"),
      // Numbers (Int + Double)
      {
        ...groupedControl([
          dataControl("age", "Age"),
          dataControl("rating", "Rating"),
        ]),
        groupOptions: { type: GroupRenderType.Flex, gap: "1rem" },
      } as ControlDefinition,
      // Date variants
      {
        ...groupedControl([
          dataControl("birthday", "Birthday"),
          dataControl("lastLogin", "Last login"),
          dataControl("wakeAt", "Wake at"),
        ]),
        groupOptions: { type: GroupRenderType.Grid, columns: 3 },
      } as ControlDefinition,
      // Options-bearing fields (Standard → Select via has-options matcher)
      dataControl("color", "Color (Standard+options → Select)"),
      // Explicit Radio
      {
        ...dataControl("size", "Size (Radio)"),
        renderOptions: { type: DataRenderType.Radio },
      } as ControlDefinition,
      // CheckList against a collection
      {
        ...dataControl("tags", "Tags (CheckList)"),
        renderOptions: { type: DataRenderType.CheckList },
      } as ControlDefinition,
      // Autocomplete
      {
        ...dataControl("country", "Country (Autocomplete)"),
        renderOptions: { type: DataRenderType.Autocomplete },
      } as ControlDefinition,
      // DisplayOnly
      {
        ...dataControl("displayed", "Display-only (read-only formatted)"),
        renderOptions: { type: DataRenderType.DisplayOnly },
      } as ControlDefinition,
      // Array of compound rows
      compoundControl("address", "Addresses (array)", [
        dataControl("street", "Street"),
        dataControl("city", "City"),
        dataControl("zip", "ZIP"),
      ]),
      // Inline group: lays children out as a horizontal <span>
      {
        ...groupedControl(
          [
            textDisplayControl("Hello,"),
            dataControl("firstName", "First"),
            dataControl("lastName", "Last"),
          ],
          "Inline group",
        ),
        groupOptions: { type: GroupRenderType.Inline },
      } as ControlDefinition,
      // Contents group: transparent passthrough (no wrapper element)
      {
        ...groupedControl(
          [
            textDisplayControl(
              "Contents group renders children with no wrapper element.",
            ),
            dataControl("secret", "Inside contents group"),
          ],
          "Contents group",
        ),
        groupOptions: { type: GroupRenderType.Contents },
      } as ControlDefinition,
      // SelectChild group: shows the child at index `shownChildIndex`
      groupedControl(
        [
          dataControl("shownChildIndex", "Shown child (0–2)"),
          {
            ...groupedControl(
              [
                groupedControl(
                  [textDisplayControl("Panel 0 — first child")],
                  "Panel 0",
                ),
                groupedControl(
                  [
                    textDisplayControl("Panel 1 — second child"),
                    dataControl("panelA", "Panel A field"),
                  ],
                  "Panel 1",
                ),
                groupedControl(
                  [
                    textDisplayControl("Panel 2 — third child"),
                    dataControl("panelB", "Panel B field"),
                  ],
                  "Panel 2",
                ),
              ],
              "SelectChild target",
            ),
            groupOptions: {
              type: GroupRenderType.SelectChild,
              childIndexExpression: dataExpr("shownChildIndex"),
            } as SelectChildRenderOptions,
          } as ControlDefinition,
        ],
        "SelectChild group",
      ),
      // Icon display
      {
        type: ControlDefinitionType.Display,
        title: "Icon display",
        displayData: {
          type: DisplayDataType.Icon,
          iconClass: "",
          icon: { library: IconLibrary.Material, name: "star" },
        } as IconDisplay,
      } as DisplayControlDefinition,
      // Custom display (resolved via FormOptions.customDisplays)
      {
        type: ControlDefinitionType.Display,
        title: "Custom display",
        displayData: {
          type: DisplayDataType.Custom,
          customId: "showcase-banner",
        } as CustomDisplay,
      } as DisplayControlDefinition,
      // Icon adornment (LabelStart) on a field
      {
        ...dataControl("displayed", "Field with label-start icon"),
        adornments: [
          {
            type: ControlAdornmentType.Icon,
            iconClass: "",
            icon: { library: IconLibrary.Material, name: "star" },
            placement: "LabelStart",
          } as IconAdornment,
        ] as ControlAdornment[],
      } as ControlDefinition,
      // Accordion adornment (per-field <details> wrapper)
      {
        ...dataControl("secret", "Wrapped in an accordion (per-field)"),
        adornments: [
          {
            type: ControlAdornmentType.Accordion,
            title: "Show secret field",
            defaultExpanded: false,
          } as AccordionAdornment,
        ] as ControlAdornment[],
      } as ControlDefinition,
    ],
    "Renderer Showcase",
  );
}

// ── Page ─────────────────────────────────────────────────────────────

const emptySchemaResolver: SchemaTreeResolver = {
  getSchemaTree: () => undefined,
};
const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const ShowcaseBanner: ComponentType<{ data: DisplayData }> = () => (
  <div className="rounded bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900 dark:text-amber-100">
    Custom display rendered via FormOptions.customDisplays
  </div>
);

const showcaseFormOptions: HtmlFormOptions = {
  customDisplays: {
    "showcase-banner": ShowcaseBanner,
  },
};

const controlContext = createControlContext();

const ShowcaseInner = controls(function ShowcaseInner({}, { controlContext }) {
  const ref = useRef<{
    rootControl: Control<unknown>;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!ref.current) {
    const rootControl = controlContext.newControl({
      name: "",
      bio: "",
      subscribed: false,
      age: 25,
      rating: 4.5,
      birthday: "1990-01-01",
      lastLogin: "2026-05-01T09:30",
      wakeAt: "07:00",
      color: "blue",
      size: "M",
      tags: ["new"],
      country: "AU",
      displayed: "Showcase value",
      address: [
        { street: "1 Main St", city: "Hobart", zip: "7000" },
      ],
      firstName: "Ada",
      lastName: "Lovelace",
      secret: "shhh",
      shownChildIndex: 1,
      panelA: "panel-a",
      panelB: "panel-b",
    });
    const schemaTree = createStaticSchemaTree(
      showcaseSchema(),
      emptySchemaResolver,
    );
    const formTree = createStaticFormTree(
      [showcaseFormDef()],
      emptyFormResolver,
    );
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    ref.current = {
      rootControl,
      formRoot: formTree.rootNode,
      dataRoot,
    };
  }

  const { rootControl, formRoot, dataRoot } = ref.current;
  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
          Renderer Showcase
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Every default renderer rendered against a kitchen-sink schema.
          Edit values on the left and watch the JSON on the right update
          reactively.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
            <Form node={formNode} options={showcaseFormOptions} />
          </div>
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-4 shadow lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Form data (live JSON)
            </h2>
            <DataJson control={rootControl} />
          </div>
        </div>
      </div>
    </div>
  );
});

const DataJson = controls(function DataJson(
  { control }: { control: Control<unknown> },
  { rc },
) {
  const value = rc.getValue(control);
  return (
    <pre className="overflow-auto rounded bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 p-3 text-xs font-mono whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
});

export default function ShowcasePage() {
  return (
    <ControlContextProvider value={controlContext}>
      <ShowcaseInner />
    </ControlContextProvider>
  );
}

void ControlDefinitionType; // silence "imported but unused" if linting
