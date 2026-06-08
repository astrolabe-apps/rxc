import {
  boolField,
  buildSchema,
  compoundField,
  type ControlAdornment,
  type ControlDefinition,
  type EntityExpression,
  isDataControl,
  makeParamTag,
  type RenderOptions,
  SchemaTags,
  stringField,
} from "@rxc/forms-core";
import { rendererClass } from "@rxc/forms-react-core";
import type { ColumnHeader } from "@astroapps/datagrid";

/**
 * Per-column configuration carried as a `ColumnOptions` adornment on each
 * DataGrid column control. Mirrors the legacy
 * `@astroapps/schemas-datagrid` `ColumnOptions` shape so existing form
 * JSON (header/body cell classes, column template, sort/filter fields)
 * ports verbatim.
 */
export type ColumnOptions = Pick<
  ColumnHeader,
  | "cellClass"
  | "headerCellClass"
  | "columnTemplate"
  | "bodyCellClass"
  | "title"
  | "filterField"
  | "sortField"
> & {
  renderOptions?: RenderOptions;
  rowIndex?: boolean;
  layoutClass?: string;
  visible?: EntityExpression;
  rowSpan?: EntityExpression;
  enabledSort?: boolean;
  enabledFilter?: boolean;
  groupedColumn?: boolean;
};

/** Class slots applied to the grid container, header, and body cells. */
export interface DataGridClasses {
  className?: string;
  titleContainerClass?: string;
  removeColumnClass?: string;
  addContainerClass?: string;
  noEntriesClass?: string;
  headerCellClass?: string;
  cellClass?: string;
  bodyCellClass?: string;
  rowClass?: string;
  /** Radix popover panel class for the column filter popover. */
  popoverClass?: string;
  /** Class for the "Clear" button inside the filter popover. */
  clearFilterClass?: string;
  /** Label for the filter popover's clear button. */
  clearFilterText?: string;
}

export const defaultDataGridClasses: DataGridClasses = {
  titleContainerClass: "flex gap-2",
  addContainerClass: "flex justify-center mt-2",
  removeColumnClass: "flex items-center h-full pl-1 gap-2",
  noEntriesClass: "border-t text-center p-3",
  headerCellClass: "font-bold",
  cellClass: "",
  bodyCellClass: "border-t py-1 flex items-center",
  popoverClass:
    "text-primary-950 animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md border bg-white p-4 shadow-md outline-none",
  clearFilterClass: "underline font-bold",
  clearFilterText: "Clear",
};

/**
 * Resolve the per-column header/body classes, layering the column's own
 * adornment classes over the grid defaults (legacy `rendererClass`
 * precedence). Sort/filter fields are only surfaced when explicitly
 * enabled, falling back to the bound field for data controls.
 */
export function getColumnHeaderFromOptions(
  columnOptions: ColumnOptions | undefined,
  definition: ControlDefinition,
  gridClasses: DataGridClasses,
): Partial<ColumnHeader> {
  if (!columnOptions)
    return {
      cellClass: gridClasses.cellClass,
      headerCellClass: gridClasses.headerCellClass,
      bodyCellClass: gridClasses.bodyCellClass,
    };
  const {
    cellClass,
    headerCellClass,
    columnTemplate,
    bodyCellClass,
    title,
    filterField,
    sortField,
    enabledSort,
    enabledFilter,
  } = columnOptions;
  return {
    cellClass: rendererClass(cellClass, gridClasses.cellClass),
    bodyCellClass: rendererClass(bodyCellClass, gridClasses.bodyCellClass),
    headerCellClass: rendererClass(headerCellClass, gridClasses.headerCellClass),
    columnTemplate,
    title,
    filterField: enabledFilter ? customField(filterField) : undefined,
    sortField: enabledSort ? customField(sortField) : undefined,
  };

  function customField(custom: string | undefined) {
    return !custom && isDataControl(definition) ? definition.field : custom;
  }
}

/** Schema describing the `ColumnOptions` adornment fields (editor + scripting). */
export const ColumnOptionsFields = buildSchema<ColumnOptions>({
  columnTemplate: stringField("Column Template"),
  title: stringField("Title"),
  headerCellClass: stringField("Header Cell Class"),
  bodyCellClass: stringField("Body Cell Class"),
  cellClass: stringField("Cell Class"),
  rowIndex: boolField("Show row index"),
  layoutClass: stringField("Layout Class"),
  renderOptions: compoundField("Render Options", [], {
    schemaRef: "RenderOptions",
    tags: [makeParamTag(SchemaTags.ControlRef, "RenderOptions")],
  }),
  enabledFilter: boolField("Enable filter"),
  enabledSort: boolField("Enable sort"),
  filterField: stringField("Custom filter field"),
  sortField: stringField("Custom sort field"),
  visible: compoundField("Column visibility", [], {
    schemaRef: "EntityExpression",
    tags: [makeParamTag(SchemaTags.ControlRef, "/ExpressionForm")],
  }),
  rowSpan: compoundField("Row Span", [], {
    schemaRef: "EntityExpression",
    tags: [makeParamTag(SchemaTags.ControlRef, "/ExpressionForm")],
  }),
  groupedColumn: boolField("Grouped Column"),
});

/** `ControlAdornment.type` discriminator for column options. */
export const ColumnOptionsType = "ColumnOptions";

export function isColumnAdornment(
  c: ControlAdornment,
): c is ColumnOptions & ControlAdornment {
  return c.type === ColumnOptionsType;
}
