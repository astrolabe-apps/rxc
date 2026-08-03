"use client";

import { useRef } from "react";
import { useControls, type Rendered, useControlContext, ControlContextProvider, createControlContext } from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  accordionAdornment,
  actionControl,
  AdornmentPlacement,
  arrayElementOptions,
  boolField,
  buildSchema,
  compoundField,
  ControlDisableType,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  displayOnlyOptions,
  elementSelectedOptions,
  groupedControl,
  iconAdornment,
  intField,
  jsonataExpr,
  jsonataOptions,
  jsonataValidator,
  materialIcon,
  optionalAdornment,
  scrollListOptions,
  stringField,
  textDisplayControl,
  wizardOptions,
  withAdornments,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type SchemaField,
  type SchemaTreeResolver,
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
  return buildSchema<PageData>({
    firstName: stringField("First name"),
    lastName: stringField("Last name"),
    optionalNote: stringField("Optional note"),
    multiErrorTag: stringField("Multi-error tag"),
    favorites: stringField("Favorites", {
      collection: true,
      options: FAVORITE_OPTIONS.map((o) => ({ name: o.label, value: o.id })),
    }),
    feed: compoundField(
      "Feed",
      buildSchema<{ id: number; label: string }>({
        id: intField("ID"),
        label: stringField("Label"),
      }),
      { collection: true },
    ),
    todos: compoundField(
      "Todos",
      buildSchema<{ title: string; done: boolean }>({
        title: stringField("Title"),
        done: boolField("Done"),
      }),
      { collection: true },
    ),
    reorderable: compoundField(
      "Reorderable",
      buildSchema<{ name: string }>({
        name: stringField("Name"),
      }),
      { collection: true },
    ),
    wizardName: stringField("Wizard name"),
    wizardEmail: stringField("Wizard email"),
    wizardConfirmed: boolField("Wizard confirmed"),
  });
}

// ── Definition ───────────────────────────────────────────────────────

function pageDef(): GroupedControlsDefinition {
  // Jsonata data renderer — renders a computed greeting.
  const jsonataGreeting = dataControl(
    "firstName",
    "Greeting (Jsonata)",
    jsonataOptions({
      expression:
        '"Hello <strong>" & (firstName ? firstName : "stranger") & " " & (lastName ? lastName : "") & "</strong>"',
    }),
  );

  // ElementSelected — one checkbox per option, toggling membership.
  const favoritesGroup = groupedControl(
    [
      textDisplayControl(
        "ElementSelected: each checkbox toggles membership in the favorites array.",
      ),
      ...FAVORITE_OPTIONS.map((o) =>
        dataControl(
          "favorites",
          o.label,
          elementSelectedOptions({
            elementExpression: jsonataExpr(`'${o.id}'`),
          }),
        ),
      ),
    ],
    "ElementSelected",
  );

  // ScrollList — bottom-action driven pagination.
  const scrollList = {
    ...dataControl(
      "feed",
      "Infinite feed (ScrollList)",
      scrollListOptions({ bottomActionId: "loadMoreFeed" }),
    ),
    children: [
      dataControl("label", undefined, {
        hideTitle: true,
        ...displayOnlyOptions({}),
      }),
    ],
  };

  // ArrayElement — collection rendered as one-line summary + edit dialog.
  const todoArray = {
    ...dataControl(
      "todos",
      "Todo list (ArrayElement summary + dialog)",
      arrayElementOptions({}),
    ),
    children: [dataControl("title", "Title"), dataControl("done", "Done")],
  };

  // Optional adornment — wraps a field with null toggle + edit selector.
  const optionalNote = withAdornments(
    dataControl("optionalNote", "Optional note"),
    [optionalAdornment({ allowNull: true, editSelectable: true })],
  );

  // Multi-error rendering — `required` writes its message under
  // `<uniqueId>default`; the jsonata validator writes under `"jsonata"`.
  // Two distinct error keys on the same data control → `showAllErrors`
  // renders both as a <ul>. Try empty (both fire), "abc" (jsonata only),
  // or "ab-cd" (neither).
  const multiError = dataControl(
    "multiErrorTag",
    'Tag (multi-error demo — required + must contain "-")',
    {
      required: true,
      validators: [
        jsonataValidator(
          '$contains(multiErrorTag, "-") ? null : "Tag must contain a hyphen"',
        ),
      ],
    },
  );

  // LabelStart + LabelEnd icon adornments — both placements on one label.
  const labelPlacements = withAdornments(
    dataControl("lastName", "Last name (label-start + label-end icons)"),
    [
      iconAdornment(materialIcon("play_arrow"), {
        placement: AdornmentPlacement.LabelStart,
      }),
      iconAdornment(materialIcon("arrow_back"), {
        placement: AdornmentPlacement.LabelEnd,
      }),
    ],
  );

  // acquireDisabler — global-scoped disable while the action runs.
  const formDisablerButton = actionControl(
    "Lock form for 2 seconds (acquireDisabler / Global)",
    "lockForm",
    { disableType: ControlDisableType.Global },
  );

  // Wizard with three pages.
  const wizard = groupedControl(
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
    wizardOptions({ showSteps: true }),
  );

  // SortableArray — uses a custom renderType so only this collection
  // routes to SortableArrayRenderer (registered below).
  const sortable = {
    ...dataControl("reorderable", "Reorderable list (dnd-kit)", {
      renderOptions: { type: "SortableArray" },
    }),
    children: [dataControl("name", "Name")],
  };

  // Accordion adornment — overridden to MotionAccordionAdornment via the
  // registry below, so the per-field accordion animates.
  const accordionWrapped = withAdornments(
    dataControl("firstName", "First name (Motion accordion adornment)"),
    [
      accordionAdornment("Show first-name field (animated)", {
        defaultExpanded: false,
      }),
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
    adornments: [MotionAccordionAdornment] as unknown as ReturnType<
      typeof defaultRegistry
    >["adornments"],
  },
  defaultRegistry(),
);

function Phase4bInner(): Rendered {
  const { rc, rendered } = useControls();
  const controlContext = useControlContext();
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
      reorderable: [{ name: "Alpha" }, { name: "Bravo" }, { name: "Charlie" }],
      wizardName: "",
      wizardEmail: "",
      wizardConfirmed: false,
    });
    const feedControl = (
      rootControl.fields as { feed: Control<{ id: number; label: string }[]> }
    ).feed;
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

  return rendered(
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
          Phase 4b Demo
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Phase 4b renderers + add-on packages. Form-wide{" "}
          <code>showAllErrors</code> renders every error attached to a field.
          Visibility uses <code>SlideVisibility</code> from
          <code>@rxc/forms-motion</code>; the per-field accordion uses
          <code>MotionAccordionAdornment</code>; the reorderable list uses{" "}
          <code>SortableArrayRenderer</code> from <code>@rxc/forms-dnd</code>.
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

export default function Phase4bPage() {
  return (
    <ControlContextProvider value={controlContext}>
      <Phase4bInner />
    </ControlContextProvider>
  );
}
