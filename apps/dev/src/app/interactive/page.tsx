"use client";

import { useRef } from "react";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import type { Control } from "@rxc/controls";
import {
  accordionGroupOptions,
  actionControl,
  AdornmentPlacement,
  buildSchema,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  dataExpr,
  dialogOptions,
  helpTextAdornment,
  setFieldAdornment,
  stringField,
  tabsOptions,
  textfieldOptions,
  groupedControl,
  withAdornments,
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

interface InteractiveData {
  name: string;
  email: string;
  displayLabel: string;
  preferredContact: string;
  notes: string;
  feedback: string;
  submissionId: string;
}

function interactiveSchema(): SchemaField[] {
  return buildSchema<InteractiveData>({
    name: stringField("Name"),
    email: stringField("Email"),
    displayLabel: stringField("Display label"),
    preferredContact: stringField("Preferred contact"),
    notes: stringField("Notes"),
    feedback: stringField("Feedback"),
    submissionId: stringField("Submission ID"),
  });
}

// ── Form definition ──────────────────────────────────────────────────

function interactiveFormDef(): GroupedControlsDefinition {
  // Tabs: Personal / Notes
  const tabs = groupedControl(
    [
      groupedControl(
        [
          dataControl("name", "Name", { required: true }),
          dataControl("email", "Email"),
        ],
        "Personal",
      ),
      groupedControl(
        [
          withAdornments(
            dataControl(
              "notes",
              "Notes",
              textfieldOptions({ multiline: true }),
            ),
            [helpTextAdornment("Markdown supported")],
          ),
        ],
        "Notes",
      ),
    ],
    "Tabs demo",
    tabsOptions(),
  );

  // Accordion group: two sections
  const accordion = groupedControl(
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
    accordionGroupOptions(),
  );

  // SetField adornment: writes "label-{name}" into displayLabel
  const setFieldDemo = withAdornments(
    groupedControl(
      [
        dataControl("name", "Name (drives display label)"),
        dataControl("displayLabel", "Display label (auto from name)"),
      ],
      "SetField demo",
    ),
    [setFieldAdornment("displayLabel", dataExpr("name"))],
  );

  // Field with HelpText adornment placed at ControlEnd
  const helpTextField = withAdornments(
    dataControl("feedback", "Feedback"),
    [
      helpTextAdornment(
        "We read every submission",
        AdornmentPlacement.ControlEnd,
      ),
    ],
  );

  // Dialog group with a trigger + content
  const dialog = groupedControl(
    [
      { ...actionControl("Open dialog", "openDialog"), placement: "trigger" },
      dataControl("name", "Name"),
      actionControl("Close", "closeDialog"),
    ],
    "Edit",
    dialogOptions({ title: "Edit name" }),
  );

  // Async submit button — handled by the host's ActionScope
  const submit = actionControl("Submit", "submit");

  return groupedControl(
    [tabs, accordion, setFieldDemo, helpTextField, dialog, submit],
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
