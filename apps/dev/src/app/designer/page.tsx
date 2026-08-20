"use client";

import {
  createContext,
  type MouseEvent,
  type SyntheticEvent,
  useContext,
  useRef,
  useState,
} from "react";
import type { Control } from "@rxc/controls";
import { useControls, type Rendered, useControlContext, ControlContextProvider, createControlContext } from "@rxc/controls";
import {
  buildSchema,
  createDataNode,
  createStaticFormTree,
  createStaticSchemaTree,
  dataControl,
  dataExpr,
  groupedControl,
  intField,
  SchemaTags,
  stringField,
  type ControlAdornment,
  type ControlDefinition,
  type DataControlDefinition,
  type FormTreeResolver,
  type GroupedControlsDefinition,
  type SchemaField,
  type SchemaTreeResolver,
} from "@rxc/forms-core";
import { FieldType } from "@rxc/forms-core";
import {
  ActionScope,
  type AdornmentRegistration,
  type AdornmentRenderProps,
  combineRegistries,
  dataPlugin,
  type DataRendererProps,
  defaultRegistry,
  Form,
  type FormRegistry,
  useDesignMode,
  useFormStateNode,
  type VisibilityProps,
} from "@rxc/forms";

// ── Custom data plugin: Stars rating ─────────────────────────────────

interface StarsRenderOptions {
  type: "Stars";
  maxStars?: number;
}

function StarsRenderer({ node, id }: DataRendererProps): Rendered {
  const { rc, rendered, update } = useControls();
  const { data, definition, disabled, readonly } = node.getState(rc);
  if (!data) return rendered(null);
  const value = (rc.getValue(data) as number | null | undefined) ?? 0;
  const opts = (definition as { renderOptions?: StarsRenderOptions })
    .renderOptions;
  const maxStars = opts?.maxStars ?? 5;
  const stars: number[] = [];
  for (let i = 1; i <= maxStars; i++) stars.push(i);
  return rendered(
    <div
      id={id}
      role="radiogroup"
      aria-label="Rating"
      className="inline-flex items-center gap-1"
    >
      {stars.map((i) => (
        <button
          key={i}
          type="button"
          disabled={disabled || readonly}
          onClick={() => update((wc) => wc.setValue(data, i))}
          className={`text-2xl leading-none ${
            i <= value ? "text-amber-400" : "text-zinc-300 dark:text-zinc-600"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-110 transition"}`}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          aria-pressed={i <= value}
        >
          ★
        </button>
      ))}
      <span className="ml-2 text-xs text-zinc-500">
        ({value} / {maxStars})
      </span>
    </div>
  );
}

// Plugin schema declares the renderer's options, with `maxStars` flagged
// scriptable. This is the load-bearing claim of the "schemaExtensions
// is runtime metadata" design — without it, scripts on `maxStars` no-op.
const starsSchema: SchemaField[] = [
  {
    field: "maxStars",
    type: FieldType.Int,
    tags: [SchemaTags.ScriptNullInit],
    defaultValue: 5,
  },
];

const starsPlugin = dataPlugin({
  type: "Stars",
  component: StarsRenderer,
  schema: starsSchema,
});

// ── Selection adornment (design mode only) ───────────────────────────

interface SelectionState {
  selected: string | null;
  setSelected: (id: string | null) => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

function SelectionAdornmentRender({ node, children }: AdornmentRenderProps): Rendered {
  const { rc, rendered } = useControls();
  const designing = useDesignMode();
  const sel = useContext(SelectionContext);
  if (!designing || !sel) return rendered(<>{children}</>);
  const isSelected = sel.selected === node.uniqueId;
  const def = node.getState(rc).definition as ControlDefinition & {
    field?: string;
    compoundField?: string;
    title?: string;
  };
  const badge = def.field ?? def.compoundField ?? def.title ?? null;
  // Mirror legacy FormControlPreview mouse-capture: containers (groups
  // and data-with-children) use bubbling onClick so the deepest leaf
  // wins; leaves use onClickCapture + onMouseDownCapture to block input
  // focus before the browser can deliver it.
  const hasChildren = (def.children?.length ?? 0) > 0;
  const isContainer = def.type === "Group" || hasChildren;
  const select = (e: SyntheticEvent) => {
    e.stopPropagation();
    sel.setSelected(node.uniqueId);
  };
  const mouseCapture = isContainer
    ? { onClick: select }
    : {
        onClickCapture: (e: MouseEvent) => {
          e.preventDefault();
          select(e);
        },
        onMouseDownCapture: (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        },
      };
  return rendered(
    <div
      {...mouseCapture}
      data-form-node={node.uniqueId}
      style={{
        position: "relative",
        backgroundColor: isSelected ? "rgba(25, 118, 210, 0.08)" : undefined,
        cursor: "pointer",
        padding: "2px",
        borderRadius: "4px",
      }}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            fontSize: "10px",
            padding: "1px 4px",
            border: "solid 1px rgba(0, 0, 0, 0.4)",
            background: "white",
            color: "black",
            borderRadius: "2px",
            fontFamily: "monospace",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {badge}
        </span>
      )}
      {children}
    </div>
  );
}

const SelectionAdornment: AdornmentRegistration = {
  type: "_Selection",
  kind: "field",
  // Higher than AccordionAdornment (1000) so the selection chrome wraps
  // every other field-kind decoration.
  priority: 2000,
  render: SelectionAdornmentRender,
};

// ── Design-mode visibility (always renders, matching legacy preview) ─

function DesignVisibility({ children }: VisibilityProps) {
  return <>{children}</>;
}

// ── Schema and form definition ───────────────────────────────────────

interface DesignerData {
  name: string;
  rating: number;
  maxStarsLimit: number;
  secret: string;
}

function designerSchema(): SchemaField[] {
  return buildSchema<DesignerData>({
    name: stringField("Name"),
    rating: intField("Rating"),
    maxStarsLimit: intField("Max stars limit"),
    secret: stringField("Secret"),
  });
}

/** Inject `_Selection` into every node's adornment list when designing,
 * so SelectionAdornment wraps each Field. */
function withSelectionAdornments(def: ControlDefinition): ControlDefinition {
  const ad: ControlAdornment = { type: "_Selection" };
  const next: ControlDefinition = {
    ...def,
    adornments: [...(def.adornments ?? []), ad],
  };
  const grouped = next as GroupedControlsDefinition;
  if (grouped.children) {
    grouped.children = grouped.children.map(withSelectionAdornments);
  }
  return next;
}

function designerFormDef(designing: boolean): GroupedControlsDefinition {
  const ratingDef: DataControlDefinition = dataControl(
    "rating",
    "Rating (custom Stars plugin)",
    {
      renderOptions: {
        type: "Stars",
        maxStars: 5,
        // Script on the plugin's own option — this only works when the
        // schemaExtensions for the Stars render type are threaded into
        // the FormStateNode's scripted-proxy walker.
        $scripts: {
          maxStars: dataExpr("../maxStarsLimit"),
        },
      } as DataControlDefinition["renderOptions"],
    },
  );
  const limitDef = dataControl(
    "maxStarsLimit",
    "Max stars (drives the Stars plugin via $scripts)",
  );
  // Always-hidden field — visible only in design mode (DesignVisibility
  // renders hidden nodes with reduced opacity).
  const hiddenDef = dataControl("secret", "Hidden field (visible in design mode)", {
    hidden: true,
    adornments: [],
  });

  const root = groupedControl(
    [dataControl("name", "Name"), ratingDef, limitDef, hiddenDef],
    "Custom plugin demo",
  );
  return designing
    ? (withSelectionAdornments(root) as GroupedControlsDefinition)
    : root;
}

// ── Page ─────────────────────────────────────────────────────────────

const emptySchemaResolver: SchemaTreeResolver = {
  getSchemaTree: () => undefined,
};
const emptyFormResolver: FormTreeResolver = {
  getFormTree: () => undefined,
};

const controlContext = createControlContext();

function DesignerInner(): Rendered {
  const { rc, rendered } = useControls();
  const controlContext = useControlContext();
  const [designing, setDesigning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const ref = useRef<{
    rootControl: Control<unknown>;
  } | null>(null);
  if (!ref.current) {
    const rootControl = controlContext.newControl({
      name: "Pat",
      rating: 3,
      maxStarsLimit: 5,
      secret: "private",
    });
    ref.current = { rootControl };
  }
  const { rootControl } = ref.current;

  // The form tree depends on `designing` (we inject selection adornments
  // when on); rebuild on toggle.
  const formRoot = useRef<{
    designing: boolean;
    formRoot: ReturnType<typeof createStaticFormTree>["rootNode"];
    dataRoot: ReturnType<typeof createDataNode>;
  } | null>(null);
  if (!formRoot.current || formRoot.current.designing !== designing) {
    const schemaTree = createStaticSchemaTree(
      designerSchema(),
      emptySchemaResolver,
    );
    const formTree = createStaticFormTree(
      [designerFormDef(designing)],
      emptyFormResolver,
    );
    const dataRoot = createDataNode(schemaTree.rootNode, rootControl);
    formRoot.current = {
      designing,
      formRoot: formTree.rootNode,
      dataRoot,
    };
  }

  const registry: FormRegistry = combineRegistries(
    starsPlugin,
    {
      adornments: [SelectionAdornment as AdornmentRegistration],
    },
    defaultRegistry(),
  );

  const formNode = useFormStateNode(
    controlContext,
    formRoot.current.formRoot,
    formRoot.current.dataRoot,
    { registry },
  );

  const stubAction = () => true; // ActionScope swallows everything in design mode

  return rendered(
    <SelectionContext.Provider value={{ selected, setSelected }}>
      <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 font-sans">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            Phase 4: Plugins + Design Mode
          </h1>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            Custom <code>Stars</code> data plugin with a scripted
            <code> maxStars</code> option (driven by the &ldquo;Max stars&rdquo;
            field via the registry&apos;s <code>schemaExtensions</code>). Toggle
            design mode to render every node (hidden fields included) read-only
            with selection chrome — click any node to select it, and notice that
            actions are stubbed.
          </p>

          <div className="mb-4 flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={designing}
                onChange={(e) => setDesigning(e.target.checked)}
              />
              Design mode
            </label>
            {designing && selected && (
              <span className="text-xs font-mono text-blue-600">
                Selected: {selected}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg bg-white dark:bg-zinc-900 p-6 shadow">
              {designing ? (
                <ActionScope onAction={stubAction}>
                  <Form
                    node={formNode}
                    registry={registry}
                    visibility={DesignVisibility}
                    designMode={true}
                  />
                </ActionScope>
              ) : (
                <Form node={formNode} registry={registry} />
              )}
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
    </SelectionContext.Provider>
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

export default function DesignerPage() {
  return (
    <ControlContextProvider value={controlContext}>
      <DesignerInner />
    </ControlContextProvider>
  );
}
