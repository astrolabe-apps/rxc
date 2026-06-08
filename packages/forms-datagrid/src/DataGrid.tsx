"use client";

import { controls } from "@rxc/controls";
import type { Control, ReadContext } from "@rxc/controls-core";
import {
  boolField,
  buildSchema,
  type ChildNodeSpec,
  type ChildResolverFunc,
  ControlDefinitionType,
  type DataControlDefinition,
  type FormStateNode,
  type GroupedControlsDefinition,
  GroupRenderType,
  isDataControl,
  type RenderOptions,
  stringField,
} from "@rxc/forms-core";
import {
  dataPlugin,
  type DataRendererProps,
  type FormRegistry,
  rendererClass,
} from "@rxc/forms-react-core";
import { Field } from "@rxc/forms";
import {
  type ColumnDefInit,
  columnDefinitions,
  DataGrid,
} from "@astroapps/datagrid";
import {
  type ColumnOptions,
  type DataGridClasses,
  defaultDataGridClasses,
  getColumnHeaderFromOptions,
  isColumnAdornment,
} from "./columnAdornment";

/** `renderOptions.type` discriminator for the DataGrid renderer. */
export const DataGridRenderType = "DataGrid";

/**
 * DataGrid-specific render options. The display-only subset of the legacy
 * `@astroapps/schemas-datagrid` options — add/remove/edit actions and
 * search/filter/sort wiring are not yet ported (see package README).
 */
export interface DataGridOptions {
  noAdd?: boolean;
  noRemove?: boolean;
  noReorder?: boolean;
  displayOnly?: boolean;
  noEntriesText?: string;
}

const DataGridFields = buildSchema<DataGridOptions>({
  noAdd: boolField("No Add"),
  noRemove: boolField("No remove"),
  noReorder: boolField("No reorder"),
  displayOnly: boolField("Display only"),
  noEntriesText: stringField("No entries text"),
});

/**
 * Child resolver for a DataGrid data control. Expands the bound array into
 * one row child per element; each row is a `Contents` group bound to the
 * element's DataNode whose own children resolve to the grid's declared
 * column controls (via `node: form`). The renderer then reads each row's
 * children as the per-column cells.
 *
 * This mirrors the legacy two-level (headers group + data array) resolver,
 * but skips the synthesized headers group — column header metadata is read
 * directly from the definition's `children` in the renderer.
 */
export const dataGridResolveChildren: ChildResolverFunc = (
  node: FormStateNode,
  rc: ReadContext,
): ChildNodeSpec[] => {
  const { form } = node;
  if (!form) return [];
  const dataNode = node.getState(rc).dataNode;
  if (!dataNode) return [];

  const cursor = dataNode.cursor(rc);
  const arrayControl = cursor.control as Control<unknown[]>;
  const elements = rc.getElements(arrayControl);

  const specs: ChildNodeSpec[] = [];
  for (let i = 0; i < elements.length; i++) {
    const elementCursor = cursor.childElement(i);
    if (!elementCursor) continue;
    const elementDataNode = elementCursor.node;
    const elemControl = elements[i];
    specs.push({
      childKey: `${elemControl.uniqueId}/${i}`,
      create: () => ({
        definition: {
          type: ControlDefinitionType.Group,
          groupOptions: { type: GroupRenderType.Contents },
        } as GroupedControlsDefinition,
        parent: elementDataNode,
        node: form,
      }),
    });
  }
  return specs;
};

function createDataGridRenderer(classes?: DataGridClasses) {
  const gridClasses: DataGridClasses = { ...defaultDataGridClasses, ...classes };

  return controls<DataRendererProps>("DataGridRenderer", ({ node }, { rc }) => {
    const state = node.getState(rc);
    const def = state.definition;
    if (!isDataControl(def)) return null;

    const renderOptions = (def.renderOptions ?? {}) as DataGridOptions &
      RenderOptions;
    const columnDefs = (def.children ?? []) as DataControlDefinition[];

    // One Contents group per row; each row's children are the column cells.
    const rows = node.getChildren(rc);
    const cellGrid = rows.map((r) => r.getChildren(rc));
    const rowCount = rows.length;

    const columns: ColumnDefInit<FormStateNode, unknown>[] = columnDefs.map(
      (cd, i) => {
        const colOptions = cd.adornments?.find(isColumnAdornment) as
          | ColumnOptions
          | undefined;
        const headerOptions = getColumnHeaderFromOptions(
          colOptions,
          cd,
          gridClasses,
        );
        return {
          ...headerOptions,
          id: "c" + i,
          title: headerOptions.title ?? cd.title ?? "Column " + i,
          render: (_row: FormStateNode, rowIndex: number) => {
            if (colOptions?.rowIndex) return rowIndex + 1;
            const cell = cellGrid[rowIndex]?.[i];
            return cell ? <Field node={cell} /> : null;
          },
        };
      },
    );

    // Trailing `auto`-width column mirroring the legacy DataGrid's
    // edit/remove-action column. Display-only here, so the cell is the
    // empty `removeColumnClass` div (no actions) — kept so column
    // templates and per-row markup match the legacy output.
    const allColumns = columnDefinitions<FormStateNode, unknown>(...columns, {
      id: "deleteCheck",
      columnTemplate: "auto",
      render: () => <div className={gridClasses.removeColumnClass} />,
    });

    return (
      <DataGrid
        className={rendererClass(def.styleClass, gridClasses.className)}
        columns={allColumns}
        bodyRows={rowCount}
        getBodyRow={(i) => rows[i]}
        defaultColumnTemplate="1fr"
        cellClass=""
        headerCellClass=""
        bodyCellClass=""
        renderHeaderContent={(col) => (
          <div className={gridClasses.titleContainerClass}>{col.title}</div>
        )}
        renderExtraRows={() =>
          rowCount === 0 ? (
            <div
              style={{ gridColumn: "1 / -1" }}
              className={gridClasses.noEntriesClass}
            >
              {renderOptions.noEntriesText ?? "No data"}
            </div>
          ) : (
            <></>
          )
        }
      />
    );
  });
}

/**
 * Registry fragment adding the display-only DataGrid renderer. Combine
 * before `defaultRegistry()` so the `DataGrid` render type beats the
 * default collection (Array) matcher.
 *
 * ```ts
 * combineRegistries(dataGridRegistry(), defaultRegistry())
 * ```
 */
export function dataGridRegistry(
  classes?: DataGridClasses,
): Partial<FormRegistry> {
  return dataPlugin({
    type: DataGridRenderType,
    component: createDataGridRenderer(classes),
    resolveChildren: dataGridResolveChildren,
    schema: DataGridFields,
  });
}
