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
  dataRef,
  type EntityExpression,
  type FieldOption,
  type FormStateNode,
  type GroupedControlsDefinition,
  GroupRenderType,
  isDataControl,
  type LengthValidator,
  type RenderOptions,
  stringField,
  ValidatorType,
} from "@rxc/forms-core";
import {
  combineRegistries,
  dataPlugin,
  type DataRendererProps,
  ensureExpressionResult,
  type FormRegistry,
  rendererClass,
  useActionHandler,
} from "@rxc/forms-react-core";
import { useControlContext } from "@rxc/controls";
import { useHtmlTheme } from "@rxc/forms";
import { Field } from "@rxc/forms";
import {
  type ColumnDefInit,
  columnDefinitions,
  DataGrid,
} from "@astroapps/datagrid";
import type { SearchFilters, SearchOptions } from "@astroapps/searchstate";
import {
  type ColumnOptions,
  type DataGridClasses,
  defaultDataGridClasses,
  getColumnHeaderFromOptions,
  isColumnAdornment,
} from "./columnAdornment";
import { FilterPopover } from "./FilterPopover";
import { SortableHeader } from "./SortableHeader";
import { pagerPlugin } from "./Pager";

/** `renderOptions.type` discriminator for the DataGrid renderer. */
export const DataGridRenderType = "DataGrid";

/**
 * `EntityExpression` fields in `ColumnOptions` (visible / rowSpan) are
 * frequently authored as `{}` placeholders by the form editor — treat any
 * value without a non-empty `type` as "no expression".
 */
function isExpr(expr: EntityExpression | undefined): expr is EntityExpression {
  return !!expr && typeof expr.type === "string" && expr.type.length > 0;
}

/**
 * Minimum/maximum allowed array length read from a data control's
 * validators. Mirrors the legacy `getLengthRestrictions` — only the
 * built-in `Length` validator is honoured here; custom validators are
 * ignored. Returns `min=0`, `max=Infinity` when no length validator is
 * present.
 */
export function getDataGridLengthRange(
  definition: DataControlDefinition,
): { min: number; max: number } {
  let min = 0;
  let max = Infinity;
  for (const v of definition.validators ?? []) {
    if (v.type === ValidatorType.Length) {
      const lv = v as LengthValidator;
      if (lv.min != null) min = lv.min;
      if (lv.max != null) max = lv.max;
    }
  }
  if (min === 0 && definition.required) min = 1;
  return { min, max };
}

/**
 * Compute row-span values for adjacent same-key runs of `keys`. The first
 * row in each run receives the run length; subsequent rows receive 0 so
 * the base grid hides their cell in the grouped column. Rows that aren't
 * in group order stay un-grouped (run length 1).
 *
 * Exported for unit testing — the renderer wires `keys` from each row's
 * `groupByField` data value and applies the result via `getRowSpan`.
 */
export function computeGroupRowSpans(keys: readonly unknown[]): number[] {
  const n = keys.length;
  const spans = new Array<number>(n).fill(1);
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && keys[j] === keys[i]) j++;
    spans[i] = j - i;
    for (let k = i + 1; k < j; k++) spans[k] = 0;
    i = j;
  }
  return spans;
}

/**
 * DataGrid-specific render options. Mirrors the legacy
 * `@astroapps/schemas-datagrid` options; the external-edit dialog flow
 * (`editExternal`/`getExternalEditData`) is not ported — hosts that need
 * an edit modal should drive it themselves via `<ActionScope>`.
 */
export interface DataGridOptions {
  noAdd?: boolean;
  noRemove?: boolean;
  noReorder?: boolean;
  displayOnly?: boolean;
  noEntriesText?: string;
  /** Override text for the add button. Defaults to `"Add"`. */
  addText?: string;
  /** Override text for the per-row remove button. Defaults to `"Remove"`. */
  removeText?: string;
  /** Override text for the per-row edit button. Defaults to `"Edit"`. */
  editText?: string;
  /** `<button data-action-id>` for the add button. Defaults to `"add"`. */
  addActionId?: string;
  /** `<button data-action-id>` for the remove button. Defaults to `"remove"`. */
  removeActionId?: string;
  /**
   * When set, each row gets an "Edit" button that fires through
   * `<ActionScope>` (legacy `editExternal`'s built-in modal is not ported).
   * Defaults to `"edit"`; an explicit value sets the dispatched id.
   */
  editActionId?: string;
  /**
   * Field reference (relative to the grid's parent data context) of a
   * sibling `SearchOptions` control. When set, filterable/sortable columns
   * drive its `filters`/`sort`/`offset` fields.
   */
  searchField?: string;
  /** Suppress the "Clear" button in column filter popovers. */
  disableClear?: boolean;
  /**
   * Per-row group key field on each row element. When set, adjacent rows
   * sharing the same value collapse via row-spanning in the bound (data)
   * column and any column flagged `groupedColumn`. Rows must already be in
   * group order — the renderer does not reorder the underlying array.
   */
  groupByField?: string;
}

const DataGridFields = buildSchema<DataGridOptions>({
  noAdd: boolField("No Add"),
  noRemove: boolField("No remove"),
  noReorder: boolField("No reorder"),
  displayOnly: boolField("Display only"),
  noEntriesText: stringField("No entries text"),
  addText: stringField("Add button text"),
  removeText: stringField("Remove button text"),
  editText: stringField("Edit button text"),
  addActionId: stringField("Add action id"),
  removeActionId: stringField("Remove action id"),
  editActionId: stringField("Edit action id"),
  searchField: stringField("Search field"),
  disableClear: boolField("Disable clear filter"),
  groupByField: stringField("Group by field"),
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

  return controls<DataRendererProps>(
    "DataGridRenderer",
    ({ node }, { rc, update }) => {
    const ctx = useControlContext();
    const actionHandler = useActionHandler();
    const actionTheme = useHtmlTheme().action ?? {};
    const state = node.getState(rc);
    const def = state.definition;
    if (!isDataControl(def)) return null;

    const renderOptions = (def.renderOptions ?? {}) as DataGridOptions &
      RenderOptions;
    const columnDefs = (def.children ?? []) as DataControlDefinition[];
    const groupByField = renderOptions.groupByField;

    // One Contents group per row; each row's children are the column cells.
    const rows = node.getChildren(rc);
    const cellGrid = rows.map((r) => r.getChildren(rc));
    const rowCount = rows.length;
    const arrayControl = state.data as Control<unknown[]> | undefined;
    const isReadonly = state.readonly || state.disabled;
    const { min, max } = getDataGridLengthRange(def as DataControlDefinition);

    const displayOnly = !!renderOptions.displayOnly;
    const showAdd =
      !displayOnly && !isReadonly && !renderOptions.noAdd && rowCount < max && !!arrayControl;
    const showRemove =
      !displayOnly && !isReadonly && !renderOptions.noRemove && !!arrayControl;
    const showEdit = !displayOnly && renderOptions.editActionId !== undefined;

    const addText = renderOptions.addText ?? "Add";
    const removeText = renderOptions.removeText ?? "Remove";
    const editText = renderOptions.editText ?? "Edit";
    const addActionId = renderOptions.addActionId ?? "add";
    const removeActionId = renderOptions.removeActionId ?? "remove";
    const editActionId = renderOptions.editActionId ?? "edit";

    const btnClass =
      gridClasses.actionButtonClass ??
      rendererClass(
        actionTheme.buttonLayoutClass ?? "inline-flex items-center justify-center gap-1.5",
        rendererClass(
          actionTheme.buttonClass ?? "px-3 py-1 rounded text-sm disabled:opacity-40",
          actionTheme.primaryClass ?? "bg-blue-600 text-white",
        ),
      );

    const dispatchOrRun = async (
      actionId: string,
      data: unknown,
      fallback?: () => void,
    ) => {
      const handled = await actionHandler(actionId, data);
      if (!handled && fallback) fallback();
    };

    // Per-row group span for `groupByField`: walk rows in current order and
    // collapse adjacent same-key runs. Hosts wanting full grouping should
    // sort the array first — the renderer does not reorder elements.
    const groupRowSpans = (() => {
      if (!groupByField) return undefined;
      const keys = rows.map((r) => {
        const keyControl = r.parent
          ?.cursor(rc)
          .childField(groupByField)?.control;
        return keyControl ? rc.getValue(keyControl) : undefined;
      });
      return computeGroupRowSpans(keys);
    })();

    // Resolve the sibling SearchOptions control (filters/sort/offset) that
    // filterable/sortable columns drive. Resolved relative to the grid's
    // parent data context (legacy `dataContext.parentNode`).
    const searchControl = renderOptions.searchField
      ? (dataRef(node.parent.cursor(rc), renderOptions.searchField)
          ?.control as Control<SearchOptions> | undefined)
      : undefined;
    const filtersControl = searchControl?.fields
      .filters as Control<SearchFilters | null> | undefined;
    const sortControl = searchControl?.fields.sort as
      | Control<string[] | null>
      | undefined;
    const offsetControl = searchControl?.fields.offset as
      | Control<number>
      | undefined;

    // Per-column filter/sort header config, keyed by the column id. Built
    // alongside the column defs and consumed by `renderHeaderContent`.
    const headerConfig: Record<
      string,
      { filterKey?: string; sortKey?: string; options: FieldOption[] }
    > = {};

    const visibleColumns: { cd: DataControlDefinition; i: number }[] = [];
    for (let i = 0; i < columnDefs.length; i++) {
      const cd = columnDefs[i]!;
      const colOptions = cd.adornments?.find(isColumnAdornment) as
        | ColumnOptions
        | undefined;
      if (isExpr(colOptions?.visible)) {
        const result = rc.getValue(
          ensureExpressionResult(
            ctx,
            node,
            colOptions!.visible!,
            "$colVisible/" + i,
            true,
          ),
        );
        if (result === false) continue;
      }
      visibleColumns.push({ cd, i });
    }

    const columns: ColumnDefInit<FormStateNode, unknown>[] = visibleColumns.map(
      ({ cd, i }) => {
        const colOptions = cd.adornments?.find(isColumnAdornment) as
          | ColumnOptions
          | undefined;
        const headerOptions = getColumnHeaderFromOptions(
          colOptions,
          cd,
          gridClasses,
        );
        const id = "c" + i;
        const colField = isDataControl(cd) ? cd.field : undefined;
        const filterKey = colOptions?.enabledFilter
          ? (colOptions.filterField ?? colField ?? undefined)
          : undefined;
        const sortKey = colOptions?.enabledSort
          ? (colOptions.sortField ?? colField ?? undefined)
          : undefined;
        if (filterKey || sortKey) {
          // Resolve the column's option values from a populated cell's
          // already-resolved fieldOptions (reactive). Empty when no rows.
          const cell = cellGrid.find((r) => r[i])?.[i];
          const options = cell ? (cell.getState(rc).fieldOptions ?? []) : [];
          headerConfig[id] = { filterKey, sortKey, options };
        }

        const rowSpanExpr = isExpr(colOptions?.rowSpan)
          ? colOptions!.rowSpan!
          : undefined;
        const isGroupByColumn =
          !!groupByField &&
          ((isDataControl(cd) && cd.field === groupByField) ||
            !!colOptions?.groupedColumn);
        const getRowSpan =
          rowSpanExpr || (isGroupByColumn && groupRowSpans)
            ? (_row: FormStateNode, index: number) => {
                if (rowSpanExpr) {
                  const cell = cellGrid[index]?.[i];
                  if (!cell) return 1;
                  const result = rc.getValue(
                    ensureExpressionResult(
                      ctx,
                      cell,
                      rowSpanExpr,
                      "$cellRowSpan",
                      1,
                    ),
                  );
                  return typeof result === "number" ? result : 1;
                }
                return groupRowSpans![index] ?? 1;
              }
            : undefined;

        return {
          ...headerOptions,
          id,
          title: headerOptions.title ?? cd.title ?? "Column " + i,
          getRowSpan,
          render: (_row: FormStateNode, rowIndex: number) => {
            if (colOptions?.rowIndex) return rowIndex + 1;
            const cell = cellGrid[rowIndex]?.[i];
            return cell ? <Field node={cell} /> : null;
          },
        };
      },
    );

    // Trailing `auto`-width column mirroring the legacy DataGrid's
    // edit/remove-action column. Holds the per-row Edit/Remove buttons
    // (when enabled) — kept even in display-only mode so column templates
    // and per-row markup match the legacy output.
    const allColumns = columnDefinitions<FormStateNode, unknown>(...columns, {
      id: "deleteCheck",
      columnTemplate: "auto",
      render: (_row, rowIndex) => {
        if (!showRemove && !showEdit) {
          return <div className={gridClasses.removeColumnClass} />;
        }
        const rowDataNode = rows[rowIndex]?.parent;
        const rowValue = rowDataNode
          ? rc.getValue(rowDataNode.cursor(rc).control)
          : undefined;
        return (
          <div className={gridClasses.removeColumnClass}>
            {showEdit ? (
              <button
                type="button"
                className={btnClass}
                onClick={() => {
                  void dispatchOrRun(editActionId, {
                    index: rowIndex,
                    value: rowValue,
                  });
                }}
              >
                {editText}
              </button>
            ) : null}
            {showRemove ? (
              <button
                type="button"
                className={btnClass}
                disabled={rowCount <= min}
                onClick={() => {
                  void dispatchOrRun(
                    removeActionId,
                    { index: rowIndex, value: rowValue },
                    () => {
                      if (arrayControl) {
                        update((wc) => wc.removeElement(arrayControl, rowIndex));
                      }
                    },
                  );
                }}
              >
                {removeText}
              </button>
            ) : null}
          </div>
        );
      },
    });

    return (
      <>
        <DataGrid
          className={rendererClass(def.styleClass, gridClasses.className)}
          columns={allColumns}
          bodyRows={rowCount}
          getBodyRow={(i) => rows[i]}
          defaultColumnTemplate="1fr"
          cellClass=""
          headerCellClass=""
          bodyCellClass=""
          renderHeaderContent={(col) => {
            const cfg = headerConfig[col.id];
            const filterEl =
              cfg?.filterKey && filtersControl && offsetControl ? (
                <FilterPopover
                  filtersControl={filtersControl}
                  offsetControl={offsetControl}
                  colKey={cfg.filterKey}
                  options={cfg.options}
                  popoverClass={gridClasses.popoverClass}
                  clearText={gridClasses.clearFilterText}
                  clearClass={gridClasses.clearFilterClass}
                  disableClear={renderOptions.disableClear}
                />
              ) : null;
            const sortEl =
              cfg?.sortKey && sortControl && offsetControl ? (
                <SortableHeader
                  sortControl={sortControl}
                  offsetControl={offsetControl}
                  sortField={cfg.sortKey}
                />
              ) : null;
            return (
              <div className={gridClasses.titleContainerClass}>
                {col.title} {filterEl} {sortEl}
              </div>
            );
          }}
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
        {showAdd ? (
          <div className={gridClasses.addContainerClass}>
            <button
              type="button"
              className={btnClass}
              onClick={() => {
                void dispatchOrRun(addActionId, undefined, () => {
                  if (arrayControl) {
                    update((wc) => wc.addElement(arrayControl, null));
                  }
                });
              }}
            >
              {addText}
            </button>
          </div>
        ) : null}
      </>
    );
  });
}

/**
 * Registry fragment adding the DataGrid + Pager renderers. Combine
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
  return combineRegistries(
    dataPlugin({
      type: DataGridRenderType,
      component: createDataGridRenderer(classes),
      resolveChildren: dataGridResolveChildren,
      schema: DataGridFields,
    }),
    pagerPlugin(),
  );
}
