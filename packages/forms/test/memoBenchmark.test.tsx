// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { useControls, type Rendered, ControlContextProvider, createControlContext } from "@rxc/controls";
import { untrackedRead, type Control } from "@rxc/controls-core";
import {
  ControlDefinitionType,
  FieldType,
  createDataNode,
  createFormStateNode,
  createFormTreeResolver,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  defaultResolveChildren,
  type ControlDefinition,
  type FormGlobalOptions,
  type FormStateNode,
  type SchemaField,
} from "@rxc/forms-core";
import {
  Form,
  Field,
  combineRegistries,
  dataPlugin,
  defaultRegistry,
  groupPlugin,
  type DataRendererProps,
  type GroupRendererProps,
} from "@rxc/forms";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const rd = untrackedRead;
const N = 500;
const TARGET = 250;

// ── Instrumentation ──────────────────────────────────────────────────
// Count how many times a leaf field renderer body actually runs. Because
// <Field> wraps the renderer, a `Field` that bails out (memo) never runs
// its data renderer — so this counter is a faithful proxy for "how many
// fields re-rendered".
const renderCounts = { field: 0 };

// Module-level knobs read inside the (module-singleton) BenchGroup at
// render time. Set fresh per run before mounting.
let useMemoField = false;
let tickControl: Control<number>;

function CountingText({ node }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const { data } = node.getState(rc);
  renderCounts.field++;
  const v = data ? rc.getValue(data) : null;
  return rendered(<span>{v == null ? "" : String(v)}</span>);
}

type FieldLike = React.ComponentType<{ node: FormStateNode }>;

// The shipped `Field` is now `React.memo`-wrapped. Unwrap it via memo's
// `.type` to get the raw (non-bailing) component as the "no-memo" baseline,
// so the benchmark still contrasts bailout vs no-bailout against the real
// Field internals.
const ShippedField = Field as unknown as FieldLike;
const PlainField: FieldLike =
  (Field as unknown as { type?: FieldLike }).type ?? ShippedField;

// A group renderer that (a) reads `tickControl` so we can force it to
// re-render on demand, and (b) renders each child through either the raw
// Field or the shipped memo(Field), controlled by `useMemoField`.
function BenchGroup({ node }: GroupRendererProps): Rendered {
  const { rc, rendered } = useControls();
  rc.getValue(tickControl); // subscribe: toggling tick re-renders this group
  const children = node.getChildren(rc);
  const F = useMemoField ? ShippedField : PlainField;
  return rendered(
    <div>
      {children.map((c) => (
        <F node={c} key={c.uniqueId} />
      ))}
    </div>,
  );
}

// ── Static (stateless) schema + form definitions, built once ─────────
const schemaFields: SchemaField[] = Array.from(
  { length: N },
  (_, i) => ({ type: FieldType.String, field: "f" + i }) as SchemaField,
);

const groupDef: ControlDefinition = {
  type: ControlDefinitionType.Group,
  groupOptions: { type: "BenchGroup" },
  children: Array.from(
    { length: N },
    (_, i) =>
      ({
        type: ControlDefinitionType.Data,
        field: "f" + i,
        hideTitle: true,
        renderOptions: { type: "BenchText" },
      }) as ControlDefinition,
  ),
} as ControlDefinition;

const initialData = Object.fromEntries(schemaFields.map((f) => [f.field, ""]));

const registry = combineRegistries(
  groupPlugin({ type: "BenchGroup", component: BenchGroup }),
  dataPlugin({ type: "BenchText", component: CountingText }),
  defaultRegistry(),
);

interface RunResult {
  mount: number;
  valueToggle: number;
  ancestorRerender: number;
}

function runBench(useMemo: boolean): RunResult {
  useMemoField = useMemo;
  const ctx = createControlContext();
  tickControl = ctx.newControl(0);

  const schemaTree = createStaticSchemaTree(
    schemaFields,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [groupDef],
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl(initialData);
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren: defaultResolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
  const groupNode: FormStateNode = root.getChildren(rd)[0];

  const container = document.createElement("div");
  document.body.appendChild(container);
  const reactRoot = createRoot(container);

  renderCounts.field = 0;
  act(() => {
    reactRoot.render(
      <ControlContextProvider value={ctx}>
        <Form node={groupNode} registry={registry} />
      </ControlContextProvider>,
    );
  });
  const mount = renderCounts.field;

  // Scenario A — toggle ONE field's value.
  renderCounts.field = 0;
  const targetData = groupNode.getChildren(rd)[TARGET].getState(rd).data!;
  act(() => {
    ctx.update((wc) => wc.setValue(targetData, "changed"));
  });
  const valueToggle = renderCounts.field;

  // Scenario B — force the ancestor group to re-render (simulating a
  // group-level state change / add-remove: any reason the parent re-runs).
  renderCounts.field = 0;
  act(() => {
    ctx.update((wc) => wc.setValue(tickControl, 1));
  });
  const ancestorRerender = renderCounts.field;

  act(() => reactRoot.unmount());
  document.body.removeChild(container);

  return { mount, valueToggle, ancestorRerender };
}

describe(`React.memo(Field) benchmark — ${N}-field form`, () => {
  it("compares field-renderer executions with and without memo", () => {
    const plain = runBench(false);
    const memoized = runBench(true);

    // eslint-disable-next-line no-console
    console.log(
      "\n  React.memo(Field) benchmark (" +
        N +
        " fields)\n" +
        "  ┌─────────────────────────────┬────────┬────────────┐\n" +
        "  │ scenario                    │ plain  │ memo(Field)│\n" +
        "  ├─────────────────────────────┼────────┼────────────┤\n" +
        `  │ initial mount               │ ${pad(plain.mount)} │ ${pad(memoized.mount)}     │\n` +
        `  │ toggle 1 field value        │ ${pad(plain.valueToggle)} │ ${pad(memoized.valueToggle)}     │\n` +
        `  │ ancestor (group) re-render  │ ${pad(plain.ancestorRerender)} │ ${pad(memoized.ancestorRerender)}     │\n` +
        "  └─────────────────────────────┴────────┴────────────┘\n",
    );

    // The common case — a single value change — is already surgical: the
    // reactive layer re-renders only the one field, memo or not.
    expect(plain.valueToggle).toBe(1);
    expect(memoized.valueToggle).toBe(1);

    // The ancestor-cascade is where memo earns its keep: without it every
    // field re-renders; with it, they bail out (stable `node` prop).
    expect(plain.ancestorRerender).toBe(N);
    expect(memoized.ancestorRerender).toBe(0);
  });
});

function pad(n: number): string {
  return String(n).padStart(6, " ");
}
