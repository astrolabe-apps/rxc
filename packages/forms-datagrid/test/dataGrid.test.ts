import { describe, it, expect } from "vitest";
import {
  createControlContext,
  untrackedRead,
  type ControlContext,
} from "@rx-controls/core";
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
} from "@rx-controls/forms-core";
import {
  computeGroupRowSpans,
  dataGridResolveChildren,
  DataGridRenderType,
  getDataGridLengthRange,
  stableGroupByKey,
} from "../src/DataGrid";
import { ValidatorType } from "@rx-controls/forms-core";
import { ColumnOptionsType } from "../src/columnAdornment";

const rd = untrackedRead;

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

function makeGrid(rows: unknown[], def: DataControlDefinition = gridDef) {
  const ctx: ControlContext = createControlContext();
  const schemaTree = createStaticSchemaTree(
    detailsSchema,
    createSchemaTreeResolver(() => undefined),
  );
  const formTree = createStaticFormTree(
    [def],
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

  it("computeGroupRowSpans collapses adjacent same-key runs", () => {
    // Three groups in sorted order: A(3), B(2), C(1).
    expect(computeGroupRowSpans(["A", "A", "A", "B", "B", "C"])).toEqual([
      3, 0, 0, 2, 0, 1,
    ]);
  });

  it("computeGroupRowSpans leaves out-of-order rows un-grouped", () => {
    // A, B, A re-appearing later isn't merged — only adjacent runs collapse.
    expect(computeGroupRowSpans(["A", "B", "A", "A"])).toEqual([1, 1, 2, 0]);
  });

  it("getDataGridLengthRange reads Length validator min/max", () => {
    expect(
      getDataGridLengthRange({
        type: ControlDefinitionType.Data,
        field: "x",
        validators: [{ type: ValidatorType.Length, min: 2, max: 7 }],
      } as DataControlDefinition),
    ).toEqual({ min: 2, max: 7 });
  });

  it("getDataGridLengthRange defaults to 0/Infinity with no validators", () => {
    expect(
      getDataGridLengthRange({
        type: ControlDefinitionType.Data,
        field: "x",
      } as DataControlDefinition),
    ).toEqual({ min: 0, max: Infinity });
  });

  it("getDataGridLengthRange treats required as min=1 when no Length min set", () => {
    expect(
      getDataGridLengthRange({
        type: ControlDefinitionType.Data,
        field: "x",
        required: true,
      } as DataControlDefinition),
    ).toEqual({ min: 1, max: Infinity });

    // Explicit Length min wins over required's default.
    expect(
      getDataGridLengthRange({
        type: ControlDefinitionType.Data,
        field: "x",
        required: true,
        validators: [{ type: ValidatorType.Length, min: 3 }],
      } as DataControlDefinition),
    ).toEqual({ min: 3, max: Infinity });
  });

  it("stableGroupByKey clusters by first-appearance key order", () => {
    const items = [
      { k: "A", n: 1 },
      { k: "B", n: 2 },
      { k: "A", n: 3 },
      { k: "C", n: 4 },
      { k: "B", n: 5 },
    ];
    const grouped = stableGroupByKey(items, (x) => x.k);
    // First-seen key order A, B, C; within-group input order preserved.
    expect(grouped.map((x) => x.k)).toEqual(["A", "A", "B", "B", "C"]);
    expect(grouped.map((x) => x.n)).toEqual([1, 3, 2, 5, 4]);
    // Idempotent: regrouping an already-grouped list is a no-op (so the
    // renderer's reorder effect converges and never loops).
    const again = stableGroupByKey(grouped, (x) => x.k);
    expect(again).toEqual(grouped);
  });

  it("computeGroupRowSpans handles edge cases", () => {
    expect(computeGroupRowSpans([])).toEqual([]);
    expect(computeGroupRowSpans(["x"])).toEqual([1]);
    expect(computeGroupRowSpans([null, null, undefined])).toEqual([2, 0, 1]);
  });

  it("prepends grid-level adornment columns as leading cells", () => {
    // A `ColumnOptions` adornment on the grid itself (not a child control)
    // synthesizes a standalone leading column bound to the row element.
    const gridWithAdornment: DataControlDefinition = {
      ...gridDef,
      adornments: [{ type: ColumnOptionsType, rowIndex: true, title: "#" }],
    } as DataControlDefinition;

    const { grid } = makeGrid(
      [
        { points: 3, offenceDate: "2024-01-01", description: "Speeding" },
        { points: 1, offenceDate: "2024-03-15", description: "Parking" },
      ],
      gridWithAdornment,
    );

    const cells = grid.getChildren(rd)[0].getChildren(rd);
    // 1 synthetic adornment column + 3 declared columns.
    expect(cells.length).toBe(4);
    // Leading synthetic cell binds to the element itself (field ".").
    expect(cells[0].getState(rd).field?.field).toBe("details");
    expect(cells[0].getState(rd).data?.valueNow).toEqual({
      points: 3,
      offenceDate: "2024-01-01",
      description: "Speeding",
    });
    // Declared columns follow, in order.
    expect(cells.slice(1).map((c) => c.getState(rd).field?.field)).toEqual([
      "points",
      "offenceDate",
      "description",
    ]);
  });

  it("resolves std columns identically when no grid-level adornment is present", () => {
    // Regression guard: the explicit row resolver must match the default
    // path's cell set/order when there are no grid-level adornment columns.
    const { grid } = makeGrid([
      { points: 3, offenceDate: "2024-01-01", description: "Speeding" },
    ]);
    const cells = grid.getChildren(rd)[0].getChildren(rd);
    expect(cells.length).toBe(3);
    expect(cells.map((c) => c.getState(rd).field?.field)).toEqual([
      "points",
      "offenceDate",
      "description",
    ]);
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
