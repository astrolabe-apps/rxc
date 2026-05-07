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
  compoundControl,
  ControlAdornmentType,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  DataRenderType,
  dataExpr,
  FieldType,
  GroupRenderType,
  groupedControl,
  type ControlAdornment,
  type ControlDefinition,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type SchemaField,
  type SchemaTreeResolver,
} from "@rxc/forms-core";
import {
  ActionScope,
  Form,
  useFormStateNode,
  type ActionHandler,
} from "@rxc/forms";

// ── Schema ───────────────────────────────────────────────────────────

function interactiveSchema(): SchemaField[] {
  return [
    { type: FieldType.String, field: "name" },
    { type: FieldType.String, field: "email" },
    { type: FieldType.String, field: "displayLabel" },
    { type: FieldType.String, field: "preferredContact" },
    { type: FieldType.String, field: "notes" },
    { type: FieldType.String, field: "feedback" },
    { type: FieldType.String, field: "submissionId" },
  ];
}

// ── Form definition ──────────────────────────────────────────────────

function adorn(
  base: ControlDefinition,
  adornments: ControlAdornment[],
): ControlDefinition {
  return { ...base, adornments } as ControlDefinition;
}

function interactiveFormDef(): GroupedControlsDefinition {
  // Tabs: Personal / Notes
  const tabs = {
    ...groupedControl(
      [
        {
          ...groupedControl(
            [
              dataControl("name", "Name", { required: true }),
              dataControl("email", "Email"),
            ],
            "Personal",
          ),
        } as ControlDefinition,
        {
          ...groupedControl(
            [
              adorn(
                {
                  ...dataControl("notes", "Notes"),
                  renderOptions: {
                    type: DataRenderType.Textfield,
                    multiline: true,
                  },
                } as ControlDefinition,
                [
                  {
                    type: ControlAdornmentType.HelpText,
                    helpText: "Markdown supported",
                  } as ControlAdornment,
                ],
              ),
            ],
            "Notes",
          ),
        } as ControlDefinition,
      ],
      "Tabs demo",
    ),
    groupOptions: { type: GroupRenderType.Tabs },
  } as ControlDefinition;

  // Accordion group: two sections
  const accordion = {
    ...groupedControl(
      [
        groupedControl(
          [dataControl("preferredContact", "Preferred contact channel")],
          "Section 1: Contact",
        ),
        groupedControl(
          [dataControl("submissionId", "Submission id (auto-filled below)")],
          "Section 2: Metadata",
        ),
      ],
      "Accordion demo",
    ),
    groupOptions: { type: GroupRenderType.Accordion },
  } as ControlDefinition;

  // SetField adornment: writes "label-{name}" into displayLabel
  const setFieldDemo = adorn(
    {
      ...groupedControl(
        [
          dataControl("name", "Name (drives display label)"),
          dataControl("displayLabel", "Display label (auto from name)"),
        ],
        "SetField demo",
      ),
      groupOptions: { type: GroupRenderType.Standard },
    } as ControlDefinition,
    [
      {
        type: ControlAdornmentType.SetField,
        field: "displayLabel",
        expression: dataExpr("name"),
      } as ControlAdornment,
    ],
  );

  // Field with HelpText adornment placed at ControlEnd
  const helpTextField = adorn(dataControl("feedback", "Feedback"), [
    {
      type: ControlAdornmentType.HelpText,
      helpText: "We read every submission",
      placement: AdornmentPlacement.ControlEnd,
    } as ControlAdornment,
  ]);

  // Dialog group with a trigger + content
  const dialog = {
    ...groupedControl(
      [
        {
          ...actionControl("Open dialog", "openDialog"),
          placement: "trigger",
        } as ControlDefinition,
        dataControl("name", "Name"),
        actionControl("Close", "closeDialog"),
      ],
      "Edit",
    ),
    groupOptions: { type: GroupRenderType.Dialog, title: "Edit name" },
  } as ControlDefinition;

  // Async submit button — handled by the host's ActionScope
  const submit = actionControl("Submit", "submit");

  return groupedControl(
    [
      tabs,
      accordion,
      setFieldDemo,
      helpTextField,
      dialog,
      submit,
    ],
    "Interactive form",
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

const InteractiveInner = controls(function InteractiveInner(
  {},
  { controlContext },
) {
  const ref = useRef<{
    rootControl: Control<unknown>;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!ref.current) {
    const rootControl = controlContext.newControl({
      name: "",
      email: "",
      displayLabel: "",
      preferredContact: "email",
      notes: "",
      feedback: "",
      submissionId: "",
    });
    const schemaTree = createStaticSchemaTree(
      interactiveSchema(),
      emptySchemaResolver,
    );
    const formTree = createStaticFormTree(
      [interactiveFormDef()],
      emptyFormResolver,
    );
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    ref.current = { rootControl, formRoot: formTree.rootNode, dataRoot };
  }

  const { rootControl, formRoot, dataRoot } = ref.current;
  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  // Host-level action handler — anything not intercepted by a nested
  // ActionScope (Dialog) lands here. Returns a Promise to demonstrate
  // the busy state.
  const onAction: ActionHandler = (id) => {
    if (id === "submit") {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
          Phase 3 Interactive Demo
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Tabs, accordion, dialog, async action button (1s simulated
          latency — watch for the busy state), helper-text adornment
          (ControlEnd placement), and a SetField adornment that mirrors{" "}
          <code>name</code> into <code>displayLabel</code>.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
            <ActionScope onAction={onAction}>
              <Form node={formNode} />
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

export default function InteractivePage() {
  return (
    <ControlContextProvider value={controlContext}>
      <InteractiveInner />
    </ControlContextProvider>
  );
}
