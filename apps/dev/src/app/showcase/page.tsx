"use client";

import { useRef } from "react";
import { useControls, type Rendered, useControlContext, ControlContextProvider, createControlContext } from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  accordionAdornment,
  AdornmentPlacement,
  autocompleteOptions,
  boolField,
  buildSchema,
  checkListOptions,
  compoundControl,
  compoundField,
  contentsOptions,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  customDisplayControl,
  dataControl,
  dataExpr,
  dateField,
  dateTimeField,
  displayOnlyOptions,
  doubleField,
  flexOptions,
  gridOptions,
  groupedControl,
  htmlDisplayControl,
  iconAdornment,
  iconDisplayControl,
  inlineOptions,
  intField,
  materialIcon,
  radioButtonOptions,
  selectChildOptions,
  stringField,
  stringOptionsField,
  textDisplayControl,
  textfieldOptions,
  timeField,
  withAdornments,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type SchemaField,
  type SchemaTreeResolver,
} from "@rxc/forms-core";
import { Form, useFormStateNode } from "@rxc/forms";
import type { HtmlFormOptions } from "@rxc/forms";
import type { ComponentType } from "react";
import type { DisplayData } from "@rxc/forms-core";

// ── Schema ───────────────────────────────────────────────────────────

interface ShowcaseData {
  name: string;
  bio: string;
  subscribed: boolean;
  age: number;
  rating: number;
  birthday: string;
  lastLogin: string;
  wakeAt: string;
  color: string;
  size: string;
  tags: string[];
  country: string;
  displayed: string;
  address: { street: string; city: string; zip: string }[];
  firstName: string;
  lastName: string;
  secret: string;
  shownChildIndex: number;
  panelA: string;
  panelB: string;
}

function showcaseSchema(): SchemaField[] {
  return buildSchema<ShowcaseData>({
    name: stringField("Name"),
    bio: stringField("Bio"),
    subscribed: boolField("Subscribed"),
    age: intField("Age"),
    rating: doubleField("Rating"),
    birthday: dateField("Birthday"),
    lastLogin: dateTimeField("Last login"),
    wakeAt: timeField("Wake at"),
    color: stringOptionsField(
      "Color",
      { name: "Red", value: "red" },
      { name: "Green", value: "green" },
      { name: "Blue", value: "blue" },
    ),
    size: stringOptionsField(
      "Size",
      { name: "Small", value: "S" },
      { name: "Medium", value: "M" },
      { name: "Large", value: "L" },
    ),
    tags: stringField("Tags", {
      collection: true,
      options: [
        { name: "Featured", value: "featured" },
        { name: "Sale", value: "sale" },
        { name: "New", value: "new" },
        { name: "Limited", value: "limited" },
      ],
    }),
    country: stringOptionsField(
      "Country",
      { name: "Australia", value: "AU" },
      { name: "Canada", value: "CA" },
      { name: "Germany", value: "DE" },
      { name: "Spain", value: "ES" },
      { name: "France", value: "FR" },
      { name: "United Kingdom", value: "GB" },
      { name: "United States", value: "US" },
    ),
    displayed: stringField("Displayed"),
    address: compoundField(
      "Addresses",
      buildSchema<{ street: string; city: string; zip: string }>({
        street: stringField("Street"),
        city: stringField("City"),
        zip: stringField("ZIP"),
      }),
      { collection: true },
    ),
    firstName: stringField("First name"),
    lastName: stringField("Last name"),
    secret: stringField("Secret"),
    shownChildIndex: intField("Shown child"),
    panelA: stringField("Panel A"),
    panelB: stringField("Panel B"),
  });
}

// ── Form definition ──────────────────────────────────────────────────

function showcaseFormDef(): GroupedControlsDefinition {
  return groupedControl(
    [
      textDisplayControl(
        "Below: kitchen sink for every default render type.",
      ),
      htmlDisplayControl(
        '<em>Rendered via <code>HtmlDisplay</code></em>',
      ),
      // Plain text (catch-all)
      dataControl("name", "Name", { required: true }),
      // Multiline
      dataControl("bio", "Bio", textfieldOptions({ multiline: true })),
      // Bool default → checkbox absorbing label
      dataControl("subscribed", "Subscribed to newsletter"),
      // Numbers (Int + Double)
      groupedControl(
        [
          dataControl("age", "Age"),
          dataControl("rating", "Rating"),
        ],
        undefined,
        flexOptions({ gap: "1rem" }),
      ),
      // Date variants
      groupedControl(
        [
          dataControl("birthday", "Birthday"),
          dataControl("lastLogin", "Last login"),
          dataControl("wakeAt", "Wake at"),
        ],
        undefined,
        gridOptions({ columns: 3 }),
      ),
      // Options-bearing fields (Standard → Select via has-options matcher)
      dataControl("color", "Color (Standard+options → Select)"),
      // Explicit Radio
      dataControl("size", "Size (Radio)", radioButtonOptions({})),
      // CheckList against a collection
      dataControl("tags", "Tags (CheckList)", checkListOptions({})),
      // Autocomplete
      dataControl("country", "Country (Autocomplete)", autocompleteOptions({})),
      // DisplayOnly
      dataControl(
        "displayed",
        "Display-only (read-only formatted)",
        displayOnlyOptions({}),
      ),
      // Array of compound rows
      compoundControl("address", "Addresses (array)", [
        dataControl("street", "Street"),
        dataControl("city", "City"),
        dataControl("zip", "ZIP"),
      ]),
      // Inline group: lays children out as a horizontal <span>
      groupedControl(
        [
          textDisplayControl("Hello,"),
          dataControl("firstName", "First"),
          dataControl("lastName", "Last"),
        ],
        "Inline group",
        inlineOptions(),
      ),
      // Contents group: transparent passthrough (no wrapper element)
      groupedControl(
        [
          textDisplayControl(
            "Contents group renders children with no wrapper element.",
          ),
          dataControl("secret", "Inside contents group"),
        ],
        "Contents group",
        contentsOptions(),
      ),
      // SelectChild group: shows the child at index `shownChildIndex`
      groupedControl(
        [
          dataControl("shownChildIndex", "Shown child (0–2)"),
          groupedControl(
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
            selectChildOptions({
              childIndexExpression: dataExpr("shownChildIndex"),
            }),
          ),
        ],
        "SelectChild group",
      ),
      // Icon display
      iconDisplayControl(materialIcon("star"), { title: "Icon display" }),
      // Custom display (resolved via FormOptions.customDisplays)
      customDisplayControl("showcase-banner", { title: "Custom display" }),
      // Icon adornment (LabelStart) on a field
      withAdornments(
        dataControl("displayed", "Field with label-start icon"),
        [iconAdornment(materialIcon("star"), {
          placement: AdornmentPlacement.LabelStart,
        })],
      ),
      // Accordion adornment (per-field <details> wrapper)
      withAdornments(
        dataControl("secret", "Wrapped in an accordion (per-field)"),
        [accordionAdornment("Show secret field", { defaultExpanded: false })],
      ),
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

function ShowcaseInner(): Rendered {
  const { rc, rendered } = useControls();
  const controlContext = useControlContext();
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

  return rendered(
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
}

function DataJson({ control }: { control: Control<unknown> }): Rendered {
  const { rc, rendered } = useControls();
  const value = rc.getValue(control);
  return rendered(
    <pre className="overflow-auto rounded bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 p-3 text-xs font-mono whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function ShowcasePage() {
  return (
    <ControlContextProvider value={controlContext}>
      <ShowcaseInner />
    </ControlContextProvider>
  );
}
