"use client";

import { useRef } from "react";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  actionControl,
  AdornmentPlacement,
  ControlAdornmentType,
  ControlDefinitionType,
  ControlDisableType,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  dataExpr,
  DataRenderType,
  FieldType,
  GroupRenderType,
  groupedControl,
  IconLibrary,
  jsonataExpr,
  lengthValidator,
  textDisplayControl,
  type AccordionAdornment,
  type ArrayElementRenderOptions,
  type CompoundField,
  type ControlAdornment,
  type ControlDefinition,
  type ElementSelectedRenderOptions,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type IconAdornment,
  type JsonataRenderOptions,
  type OptionalAdornment,
  type SchemaField,
  type SchemaTreeResolver,
  type ScrollListRenderOptions,
  type WizardRenderOptions,
} from "@rxc/forms-core";
import {
  ActionScope,
  combineRegistries,
  defaultRegistry,
  Form,
  matchAll,
  matchCollection,
  matchRenderType,
  useFormStateNode,
  type ActionHandler,
  type HtmlFormOptions,
} from "@rxc/forms";
import { SlideVisibility } from "@rxc/forms-motion";
import { MotionAccordionAdornment } from "@rxc/forms-motion";
import { SortableArrayRenderer } from "@rxc/forms-dnd";

// ── Schema ───────────────────────────────────────────────────────────

interface PageData {
  firstName: string;
  lastName: string;
  optionalNote: string | null;
  multiErrorTag: string;
  favorites: string[];
  feed: { id: number; label: string }[];
  todos: { title: string; done: boolean }[];
  reorderable: { name: string }[];
  wizardName: string;
  wizardEmail: string;
  wizardConfirmed: boolean;
}

const FAVORITE_OPTIONS: { id: string; label: string }[] = [
  { id: "apples", label: "Apples" },
  { id: "berries", label: "Berries" },
  { id: "cherries", label: "Cherries" },
  { id: "dates", label: "Dates" },
];

function pageSchema(): SchemaField[] {
  return [
    { type: FieldType.String, field: "firstName" },
    { type: FieldType.String, field: "lastName" },
    { type: FieldType.String, field: "optionalNote" },
    { type: FieldType.String, field: "multiErrorTag" },
    {
      type: FieldType.String,
      field: "favorites",
      collection: true,
      options: FAVORITE_OPTIONS.map((o) => ({ name: o.label, value: o.id })),
    },
    {
      type: FieldType.Compound,
      field: "feed",
      collection: true,
      children: [
        { type: FieldType.Int, field: "id" },
        { type: FieldType.String, field: "label" },
      ],
    } as CompoundField,
    {
      type: FieldType.Compound,
      field: "todos",
      collection: true,
      children: [
        { type: FieldType.String, field: "title" },
        { type: FieldType.Bool, field: "done" },
      ],
    } as CompoundField,
    {
      type: FieldType.Compound,
      field: "reorderable",
      collection: true,
      children: [{ type: FieldType.String, field: "name" }],
    } as CompoundField,
    { type: FieldType.String, field: "wizardName" },
    { type: FieldType.String, field: "wizardEmail" },
    { type: FieldType.Bool, field: "wizardConfirmed" },
  ];
}

// ── Definition ───────────────────────────────────────────────────────

function adorn(
  base: ControlDefinition,
  adornments: ControlAdornment[],
): ControlDefinition {
  return { ...base, adornments } as ControlDefinition;
}

function pageDef(): GroupedControlsDefinition {
  // Jsonata data renderer — renders a computed greeting.
  const jsonataGreeting = {
    ...dataControl("firstName", "Greeting (Jsonata)"),
    renderOptions: {
      type: DataRenderType.Jsonata,
      expression:
        '"Hello <strong>" & (firstName ? firstName : "stranger") & " " & (lastName ? lastName : "") & "</strong>"',
    } as JsonataRenderOptions,
  } as ControlDefinition;

  // ElementSelected — one checkbox per option, toggling membership.
  const favoritesGroup = groupedControl(
    [
      textDisplayControl(
        "ElementSelected: each checkbox toggles membership in the favorites array.",
      ),
      ...FAVORITE_OPTIONS.map(
        (o) =>
          ({
            ...dataControl("favorites", o.label),
            renderOptions: {
              type: DataRenderType.ElementSelected,
              elementExpression: jsonataExpr(`'${o.id}'`),
            } as ElementSelectedRenderOptions,
          }) as ControlDefinition,
      ),
    ],
    "ElementSelected",
  );

  // ScrollList — bottom-action driven pagination.
  const scrollList = {
    ...dataControl("feed", "Infinite feed (ScrollList)"),
    renderOptions: {
      type: DataRenderType.ScrollList,
      bottomActionId: "loadMoreFeed",
    } as ScrollListRenderOptions,
    children: [
      {
        ...dataControl("label", undefined, { hideTitle: true }),
        renderOptions: { type: DataRenderType.DisplayOnly },
      } as ControlDefinition,
    ],
  } as ControlDefinition;

  // ArrayElement — collection rendered as one-line summary + edit dialog.
  const todoArray = {
    ...dataControl("todos", "Todo list (ArrayElement summary + dialog)"),
    renderOptions: {
      type: DataRenderType.ArrayElement,
    } as ArrayElementRenderOptions,
    children: [
      dataControl("title", "Title"),
      dataControl("done", "Done"),
    ],
  } as ControlDefinition;

  // Optional adornment — wraps a field with null toggle + edit selector.
  const optionalNote = adorn(dataControl("optionalNote", "Optional note"), [
    {
      type: ControlAdornmentType.Optional,
      allowNull: true,
      editSelectable: true,
    } as OptionalAdornment,
  ]);

  // Multi-error rendering — two validators that both fail when empty/short.
  const multiError = {
    ...dataControl("multiErrorTag", "Tag (multi-error demo)", {
      required: true,
      validators: [lengthValidator(4, 8)],
    }),
  } as ControlDefinition;

  // LabelStart + LabelEnd icon adornments — both placements on one label.
  const labelPlacements = adorn(
    dataControl("lastName", "Last name (label-start + label-end icons)"),
    [
      {
        type: ControlAdornmentType.Icon,
        iconClass: "",
        icon: { library: IconLibrary.Material, name: "play_arrow" },
        placement: AdornmentPlacement.LabelStart,
      } as IconAdornment,
      {
        type: ControlAdornmentType.Icon,
        iconClass: "",
        icon: { library: IconLibrary.Material, name: "arrow_back" },
        placement: AdornmentPlacement.LabelEnd,
      } as IconAdornment,
    ],
  );

  // acquireDisabler — global-scoped disable while the action runs.
  const formDisablerButton = actionControl(
    "Lock form for 2 seconds (acquireDisabler / Global)",
    "lockForm",
    { disableType: ControlDisableType.Global },
  );

  // Wizard with three pages.
  const wizard = {
    ...groupedControl(
      [
        groupedControl(
          [dataControl("wizardName", "Name", { required: true })],
          "Step 1: Name",
        ),
        groupedControl(
          [dataControl("wizardEmail", "Email", { required: true })],
          "Step 2: Email",
        ),
        groupedControl(
          [dataControl("wizardConfirmed", "I confirm the details above")],
          "Step 3: Confirm",
        ),
      ],
      "Wizard demo",
    ),
    groupOptions: {
      type: GroupRenderType.Wizard,
      showSteps: true,
    } as WizardRenderOptions,
  } as ControlDefinition;

  // SortableArray — uses a custom renderType so only this collection
  // routes to SortableArrayRenderer (registered below).
  const sortable = {
    ...dataControl("reorderable", "Reorderable list (dnd-kit)"),
    renderOptions: { type: "SortableArray" },
    children: [dataControl("name", "Name")],
  } as ControlDefinition;

  // Accordion adornment — overridden to MotionAccordionAdornment via the
  // registry below, so the per-field accordion animates.
  const accordionWrapped = adorn(
    dataControl("firstName", "First name (Motion accordion adornment)"),
    [
      {
        type: ControlAdornmentType.Accordion,
        title: "Show first-name field (animated)",
        defaultExpanded: false,
      } as AccordionAdornment,
    ],
  );

  return groupedControl(
    [
      textDisplayControl(
        "Phase 4b additions and add-on packages — Jsonata, ElementSelected, ScrollList, ArrayElement, Wizard, Optional adornment, label-placement icons, multi-error rendering, Form-scoped disabler, SlideVisibility, MotionAccordionAdornment, SortableArrayRenderer.",
      ),
      jsonataGreeting,
      favoritesGroup,
      labelPlacements,
      multiError,
      optionalNote,
      accordionWrapped,
      scrollList,
      todoArray,
      sortable,
      wizard,
      formDisablerButton,
    ],
    "Phase 4b kitchen sink",
  );
}

// ── Page ─────────────────────────────────────────────────────────────

const emptySchemaResolver: SchemaTreeResolver = {
  getSchemaTree: () => undefined,
};
const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const controlContext = createControlContext();

const FEED_CAP = 30;
const FEED_PAGE = 5;

const formOptions: HtmlFormOptions = { showAllErrors: true };

// Custom registry — swap the Accordion adornment for the motion variant
// and register the SortableArrayRenderer for `renderType: "SortableArray"`.
const customRegistry = combineRegistries(
  {
    data: [
      matchAll(
        matchCollection(SortableArrayRenderer),
        matchRenderType("SortableArray", SortableArrayRenderer),
      ),
    ],
    adornments: [
      MotionAccordionAdornment,
    ] as unknown as ReturnType<typeof defaultRegistry>["adornments"],
  },
  defaultRegistry(),
);

const Phase4bInner = controls(function Phase4bInner({}, { controlContext }) {
  const ref = useRef<{
    rootControl: Control<PageData>;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
    feedControl: Control<{ id: number; label: string }[]>;
  } | null>(null);

  if (!ref.current) {
    const rootControl = controlContext.newControl<PageData>({
      firstName: "",
      lastName: "",
      optionalNote: null,
      multiErrorTag: "",
      favorites: ["berries"],
      feed: Array.from({ length: FEED_PAGE }, (_, i) => ({
        id: i + 1,
        label: `Item ${i + 1}`,
      })),
      todos: [
        { title: "Buy milk", done: false },
        { title: "Walk the dog", done: true },
      ],
      reorderable: [
        { name: "Alpha" },
        { name: "Bravo" },
        { name: "Charlie" },
      ],
      wizardName: "",
      wizardEmail: "",
      wizardConfirmed: false,
    });
    const feedControl = (rootControl.fields as { feed: Control<{ id: number; label: string }[]> }).feed;
    // Seed the ScrollList state — host owns the loading/hasMore flags
    // on the bound data control's `meta`. The renderer reads them and
    // dispatches the bottom action when the sentinel is in view.
    feedControl.meta.$scrollList = { loading: false, hasMore: true };

    const schemaTree = createStaticSchemaTree(
      pageSchema(),
      emptySchemaResolver,
    );
    const formTree = createStaticFormTree([pageDef()], emptyFormResolver);
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    ref.current = {
      rootControl,
      formRoot: formTree.rootNode,
      dataRoot,
      feedControl,
    };
  }

  const { rootControl, formRoot, dataRoot, feedControl } = ref.current;
  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  // Action handler — implements ScrollList pagination + the
  // long-running form-locking action.
  const onAction: ActionHandler = (id) => {
    if (id === "loadMoreFeed") {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          controlContext.update((wc) => {
            const current = feedControl.valueNow ?? [];
            const remaining = FEED_CAP - current.length;
            const toAdd = Math.min(FEED_PAGE, remaining);
            for (let i = 0; i < toAdd; i++) {
              const idx = current.length + i + 1;
              wc.addElement(feedControl, { id: idx, label: `Item ${idx}` });
            }
            const nextLen = current.length + toAdd;
            feedControl.meta.$scrollList = {
              loading: false,
              hasMore: nextLen < FEED_CAP,
            };
          });
          resolve();
        }, 400);
      });
    }
    if (id === "lockForm") {
      return new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
          Phase 4b Demo
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Phase 4b renderers + add-on packages. Form-wide{" "}
          <code>showAllErrors</code> renders every error attached to a
          field. Visibility uses <code>SlideVisibility</code> from
          <code>@rxc/forms-motion</code>; the per-field accordion uses
          <code>MotionAccordionAdornment</code>; the reorderable list
          uses <code>SortableArrayRenderer</code> from{" "}
          <code>@rxc/forms-dnd</code>.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
            <ActionScope onAction={onAction}>
              <Form
                node={formNode}
                registry={customRegistry}
                options={formOptions}
                visibility={SlideVisibility}
              />
            </ActionScope>
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

export default function Phase4bPage() {
  return (
    <ControlContextProvider value={controlContext}>
      <Phase4bInner />
    </ControlContextProvider>
  );
}

void ControlDefinitionType;
