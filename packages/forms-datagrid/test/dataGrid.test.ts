import { describe, it, expect } from "vitest";
import {
  createControlContext,
  noopReadContext,
  type ControlContext,
} from "@rxc/controls-core";
import {
  type ChildResolverFunc,
  ControlDefinitionType,
  createDataNode,
  createFormStateNode,
  createFormTreeResolver,
  createSchemaTreeResolver,
  createStaticFormTree,
  createStaticSchemaTree,
  type DataControlDefinition,
  defaultResolveChildren,
  FieldType,
  type FormGlobalOptions,
  type SchemaField,
} from "@rxc/forms-core";
import { dataGridResolveChildren, DataGridRenderType } from "../src/DataGrid";
import { ColumnOptionsType } from "../src/columnAdornment";

const rd = noopReadContext;

// Dispatch DataGrid → custom resolver, everything else → default. Mirrors
// the registry's `makeResolveChildren` so the test exercises the real path.
const resolveChildren: ChildResolverFunc = (node, rc) => {
  const def = node.getState(rc).definition as {
    renderOptions?: { type?: string };
    groupOptions?: { type?: string };
  };
  const renderType = def.renderOptions?.type ?? def.groupOptions?.type;
  if (renderType === DataGridRenderType) return dataGridResolveChildren(node, rc);
  return defaultResolveChildren(node, rc);
};

const detailsSchema: SchemaField[] = [
  {
    type: FieldType.Compound,
    field: "details",
    collection: true,
    children: [
      { type: FieldType.Int, field: "points" },
      { type: FieldType.String, field: "offenceDate" },
      { type: FieldType.String, field: "description" },
    ],
  } as SchemaField,
];

const col = (field: string, title: string): DataControlDefinition =>
  ({
    type: ControlDefinitionType.Data,
    field,
    title,
    hideTitle: true,
    renderOptions: { type: "DisplayOnly" },
    adornments: [{ type: ColumnOptionsType, title, columnTemplate: "1fr" }],
  }) as DataControlDefinition;

const gridDef: DataControlDefinition = {
  type: ControlDefinitionType.Data,
  field: "details",
  renderOptions: { type: DataGridRenderType, displayOnly: true },
  children: [
    col("points", "Points"),
    col("offenceDate", "Offence Date"),
    col("description", "Offence"),
  ],
} as DataControlDefinition;

function makeGrid(rows: unknown[]) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = createStaticSchemaTree(
    detailsSchema,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [gridDef],
    createFormTreeResolver(() => undefined),
  );
  const dataControl = ctx.newControl({ details: rows });
  const dataNode = createDataNode(schemaTree.rootNode, dataControl);
  const globals: FormGlobalOptions = {
    resolveChildren,
    runAsync: (fn) => fn(),
    clearHidden: false,
  };
  const root = createFormStateNode(ctx, formTree.rootNode, dataNode, globals);
  // root wraps the top-level controls; the grid is its single child.
  return { ctx, grid: root.getChildren(rd)[0] };
}

describe("DataGrid display-only resolver", () => {
  it("expands the bound array into one row per element, each with column cells", () => {
    const { grid } = makeGrid([
      { points: 3, offenceDate: "2024-01-01", description: "Speeding" },
      { points: 1, offenceDate: "2024-03-15", description: "Parking" },
    ]);

    const rows = grid.getChildren(rd);
    expect(rows.length).toBe(2);

    const firstCells = rows[0].getChildren(rd);
    expect(firstCells.length).toBe(3);
    expect(firstCells.map((c) => c.getState(rd).field?.field)).toEqual([
      "points",
      "offenceDate",
      "description",
    ]);
    expect(firstCells.map((c) => c.getState(rd).data?.valueNow)).toEqual([
      3,
      "2024-01-01",
      "Speeding",
    ]);

    const secondCells = rows[1].getChildren(rd);
    expect(secondCells.map((c) => c.getState(rd).data?.valueNow)).toEqual([
      1,
      "2024-03-15",
      "Parking",
    ]);
  });

  it("renders no rows for an empty array", () => {
    const { grid } = makeGrid([]);
    expect(grid.getChildren(rd).length).toBe(0);
  });

  it("reacts to elements being added", () => {
    const { ctx, grid } = makeGrid([
      { points: 3, offenceDate: "2024-01-01", description: "Speeding" },
    ]);
    expect(grid.getChildren(rd).length).toBe(1);

    // Append to the bound array; the resolver effect re-runs.
    const arrControl = grid.getState(rd).data!;
    ctx.update((wc) =>
      wc.addElement(arrControl, {
        points: 2,
        offenceDate: "2024-06-01",
        description: "Mobile phone",
      }),
    );

    expect(grid.getChildren(rd).length).toBe(2);
    expect(
      grid
        .getChildren(rd)[1]
        .getChildren(rd)
        .map((c) => c.getState(rd).data?.valueNow),
    ).toEqual([2, "2024-06-01", "Mobile phone"]);
  });
});
