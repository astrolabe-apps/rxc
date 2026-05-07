"use client";

import { useRef } from "react";
import {
  ControlContextProvider,
  controls,
  createControlContext,
} from "@rxc/controls";
import {
  actionControl,
  ActionStyle,
  buildSchema,
  ControlDisableType,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  fontAwesomeIcon,
  groupedControl,
  IconPlacement,
  inlineOptions,
  materialIcon,
  textDisplayControl,
  type ActionControlDefinition,
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
  type HtmlFormOptions,
} from "@rxc/forms";

// ── Schema (empty — actions don't bind to data) ─────────────────────

interface EmptyData {}

function emptySchema(): SchemaField[] {
  return buildSchema<EmptyData>({});
}

// ── Action helpers ───────────────────────────────────────────────────

function row(label: string, ...buttons: ActionControlDefinition[]) {
  return groupedControl(
    [textDisplayControl(label), ...buttons],
    undefined,
    inlineOptions(),
  );
}

// ── Pages ────────────────────────────────────────────────────────────

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

  // 5. Font Awesome icon set — common icons used in the legacy app,
  // for side-by-side comparison. The Kit (loaded via globals.css) is
  // the same one ServiceTas / formServer / storybook use, so visual
  // weight, glyph, and metrics should match.
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
    "Font Awesome icons (same Kit as legacy)",
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
        "Each row is an Inline group. The form-level theme below configures a busy spinner, a default icon, and base button/text classes — primary buttons inherit the chrome unless they override via styleClass/textClass.",
      ),
      variants,
      placements,
      busy,
      faIcons,
      styling,
      disabled,
    ],
    "ButtonAction renderer demo",
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

// HtmlFormOptions.theme.action — exercises every new theme slot.
const formOptions: HtmlFormOptions = {
  theme: {
    action: {
      // Base classes layered beneath every variant.
      buttonClass:
        "px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40 transition-colors",
      textClass: "tracking-wide",
      // Variant chrome.
      primaryClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
      primaryTextClass: "uppercase",
      secondaryClass:
        "border border-zinc-400 hover:bg-zinc-100 dark:border-zinc-500 dark:hover:bg-zinc-800",
      secondaryTextClass: "text-zinc-700 dark:text-zinc-200",
      linkClass:
        "text-indigo-600 hover:underline disabled:opacity-40 dark:text-indigo-400",
      linkTextClass: "underline-offset-2",
      groupClass:
        "inline-flex gap-1 rounded border border-zinc-300 dark:border-zinc-700 p-1",
      iconBeforeClass: "mr-2",
      iconAfterClass: "ml-2",
      // Default action icon — used when definition.icon is unset.
      icon: materialIcon("touch_app"),
      // Busy spinner.
      busyIcon: fontAwesomeIcon("spinner fa-spin"),
      busyIconPlacement: IconPlacement.ReplaceText,
    },
  },
};

const ButtonsInner = controls(function ButtonsInner({}, { controlContext }) {
  const ref = useRef<{
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);

  if (!ref.current) {
    const rootControl = controlContext.newControl<EmptyData>({});
    const schemaTree = createStaticSchemaTree(emptySchema(), emptySchemaResolver);
    const formTree = createStaticFormTree([buttonsDef()], emptyFormResolver);
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    ref.current = { formRoot: formTree.rootNode, dataRoot };
  }

  const { formRoot, dataRoot } = ref.current;
  const formNode = useFormStateNode(controlContext, formRoot, dataRoot);

  const onAction: ActionHandler = (id) => {
    if (id === "asyncSelf") {
      return new Promise<void>((resolve) => setTimeout(resolve, 1500));
    }
    if (id === "asyncGlobal") {
      return new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-4">
          ButtonAction renderer demo
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          Visual parity with the legacy <code>createButtonActionRenderer</code>:
          base + variant class layering, per-style text classes,{" "}
          <code>ActionStyle.Group</code>, three icon placements with{" "}
          <code>title</code> on icon-only buttons, definition-level{" "}
          <code>styleClass</code>/<code>textClass</code>, and a theme-configured
          busy spinner that swaps the label for an icon while the action runs.
          Material icons require the Material Symbols stylesheet (omitted
          here — Material rows render the ligature text as a fallback);
          FontAwesome rows use the ambient FA stylesheet if loaded.
        </p>
        <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
          <ActionScope onAction={onAction}>
            <Form node={formNode} options={formOptions} />
          </ActionScope>
        </div>
      </div>
    </div>
  );
});

export default function ButtonsPage() {
  return (
    <ControlContextProvider value={controlContext}>
      <ButtonsInner />
    </ControlContextProvider>
  );
}
