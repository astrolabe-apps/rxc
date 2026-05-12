"use client";

import { useMemo } from "react";
import { newControl } from "@react-typed-forms/core";
import {
  ActionControlDefinition,
  ActionStyle,
  ControlDataContext,
  ControlDisableType,
  GroupedControlsDefinition,
  GroupRenderType,
  IconLibrary,
  IconPlacement,
  IconReference,
  RenderForm,
  SchemaField,
  actionControl,
  buildSchema,
  createFormRenderer,
  createSchemaDataNode,
  createSchemaTree,
  fontAwesomeIcon,
  groupedControl,
  legacyFormNode,
  textDisplayControl,
} from "@react-typed-forms/schemas";
import {
  createDefaultRenderers,
  defaultTailwindTheme,
} from "@react-typed-forms/schemas-html";

// ── Schema (empty — actions don't bind to data) ─────────────────────

interface EmptyData {}

function emptySchema(): SchemaField[] {
  return buildSchema<EmptyData>({});
}

const materialIcon = (name: string): IconReference => ({
  library: IconLibrary.Material,
  name,
});

// ── Action helpers ───────────────────────────────────────────────────

function row(label: string, ...buttons: ActionControlDefinition[]) {
  return groupedControl(
    [textDisplayControl(label), ...buttons],
    undefined,
    { groupOptions: { type: GroupRenderType.Inline } },
  );
}

// ── Form definition ──────────────────────────────────────────────────

function buttonsDef(): GroupedControlsDefinition {
  // 1. ActionStyle variants — Button / Secondary / Link / Group.
  const variants = groupedControl(
    [
      row(
        "Variants:",
        actionControl("Primary", "noop", {
          actionStyle: ActionStyle.Button,
        }),
        actionControl("Secondary", "noop", {
          actionStyle: ActionStyle.Secondary,
        }),
        actionControl("Link", "noop", { actionStyle: ActionStyle.Link }),
      ),
      row(
        "Group (action bar):",
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: materialIcon("save"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: materialIcon("delete"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: materialIcon("share"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
      ),
    ],
    "ActionStyle variants",
  );

  // 2. Icon placement on a primary button.
  const placements = groupedControl(
    [
      row(
        "Before (default):",
        actionControl("Save", "noop", {
          icon: materialIcon("save"),
          iconPlacement: IconPlacement.BeforeText,
        }),
      ),
      row(
        "After:",
        actionControl("Next", "noop", {
          icon: materialIcon("arrow_forward"),
          iconPlacement: IconPlacement.AfterText,
        }),
      ),
      row(
        "Replace text (icon-only — hover for tooltip):",
        actionControl("Delete", "noop", {
          icon: materialIcon("delete"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
      ),
      row(
        "FontAwesome icon:",
        actionControl("Edit", "noop", {
          icon: fontAwesomeIcon("pencil"),
        }),
      ),
    ],
    "Icon placement",
  );

  // 3. Busy / async — different latencies + different disable scopes.
  const busy = groupedControl(
    [
      row(
        "Self-disable (1.5s):",
        actionControl("Save", "asyncSelf", {
          icon: materialIcon("save"),
          disableType: ControlDisableType.Self,
        }),
      ),
      row(
        "Global (form-wide) disable (2s):",
        actionControl("Lock form", "asyncGlobal", {
          icon: materialIcon("lock"),
          disableType: ControlDisableType.Global,
        }),
      ),
      row(
        "Async with no disableType (just busy):",
        actionControl("Submit", "asyncSelf", {
          actionStyle: ActionStyle.Secondary,
        }),
      ),
    ],
    "Busy / async",
  );

  // 4. textClass / styleClass at the definition level.
  const styling = groupedControl(
    [
      row(
        "definition.styleClass overrides bg/text:",
        actionControl("Custom red", "noop", {
          styleClass: "@ bg-red-600 text-white px-4 py-2 rounded text-sm",
        }),
      ),
      row(
        "definition.textClass on text span:",
        actionControl("Italic label", "noop", {
          icon: materialIcon("info"),
          textClass: "italic font-bold",
        }),
      ),
    ],
    "Per-action styling",
  );

  // 5. Font Awesome icon set — common icons used in legacy apps.
  // Same Kit URL as the new demo so glyph metrics are identical.
  const faIcons = groupedControl(
    [
      row(
        "Edit / Save / Delete:",
        actionControl("Edit", "noop", { icon: fontAwesomeIcon("pencil") }),
        actionControl("Save", "noop", {
          icon: fontAwesomeIcon("floppy-disk"),
          actionStyle: ActionStyle.Secondary,
        }),
        actionControl("Delete", "noop", {
          icon: fontAwesomeIcon("trash"),
          actionStyle: ActionStyle.Secondary,
        }),
      ),
      row(
        "Confirm / Cancel:",
        actionControl("Confirm", "noop", { icon: fontAwesomeIcon("check") }),
        actionControl("Cancel", "noop", {
          icon: fontAwesomeIcon("xmark"),
          actionStyle: ActionStyle.Secondary,
        }),
      ),
      row(
        "Add / Search:",
        actionControl("Add", "noop", { icon: fontAwesomeIcon("plus") }),
        actionControl("Search", "noop", {
          icon: fontAwesomeIcon("magnifying-glass"),
          actionStyle: ActionStyle.Secondary,
        }),
      ),
      row(
        "Navigation (icon-only Group):",
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: fontAwesomeIcon("chevron-left"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: fontAwesomeIcon("chevron-right"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
        actionControl("", "noop", {
          actionStyle: ActionStyle.Group,
          icon: fontAwesomeIcon("ellipsis-vertical"),
          iconPlacement: IconPlacement.ReplaceText,
        }),
      ),
      row(
        "Spin (resting + busy):",
        actionControl("Refreshing…", "noop", {
          icon: fontAwesomeIcon("rotate fa-spin"),
        }),
        actionControl("Click to spin", "asyncSelf", {
          actionStyle: ActionStyle.Secondary,
        }),
      ),
    ],
    "Font Awesome icons (same Kit as new demo)",
  );

  // 6. Disabled action.
  const disabled = groupedControl(
    [
      row(
        "Pre-disabled:",
        actionControl("Disabled primary", "noop", { disabled: true }),
        actionControl("Disabled link", "noop", {
          actionStyle: ActionStyle.Link,
          disabled: true,
        }),
      ),
    ],
    "Disabled state",
  );

  return groupedControl(
    [
      textDisplayControl(
        "Each row is an Inline group. Rendering uses createDefaultRenderers(defaultTailwindTheme) — i.e. legacy stock theming. Compare against the new /buttons demo at apps/dev (themed) and inspect markup parity across both.",
      ),
      variants,
      placements,
      busy,
      faIcons,
      styling,
      disabled,
    ],
    "ButtonAction renderer demo (legacy)",
  );
}

// ── Renderer + handler ──────────────────────────────────────────────

const renderer = createFormRenderer(
  [],
  createDefaultRenderers(defaultTailwindTheme),
);

const onAction = (
  actionId: string,
  _actionData: any,
  _ctx: ControlDataContext,
) => {
  if (actionId === "asyncSelf") {
    return () => new Promise<void>((resolve) => setTimeout(resolve, 1500));
  }
  if (actionId === "asyncGlobal") {
    return () => new Promise<void>((resolve) => setTimeout(resolve, 2000));
  }
  return () => {};
};

// ── Page ─────────────────────────────────────────────────────────────

export default function Page() {
  const { dataNode, formNode } = useMemo(() => {
    const rootControl = newControl<EmptyData>({});
    const schemaTree = createSchemaTree(emptySchema());
    const dataNode = createSchemaDataNode(schemaTree.rootNode, rootControl);
    const formNode = legacyFormNode(buttonsDef());
    return { dataNode, formNode };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-4">
          ButtonAction renderer demo (legacy schemas-html)
        </h1>
        <p className="mb-6 text-sm text-zinc-600">
          Stock <code>defaultTailwindTheme</code> from{" "}
          <code>@react-typed-forms/schemas-html</code>. Mirrors the new{" "}
          <code>/buttons</code> demo content one-for-one so markup, class
          composition, icon placement, busy spinner, and{" "}
          <code>ActionStyle.Group</code> can be compared side by side. Open
          this on <code>localhost:3001</code> alongside the new demo on{" "}
          <code>localhost:3000/buttons</code>.
        </p>
        <div className="rounded-lg bg-white p-6 shadow">
          <RenderForm
            data={dataNode}
            form={formNode}
            renderer={renderer}
            options={{ actionOnClick: onAction }}
          />
        </div>
      </div>
    </div>
  );
}
