// Public API for @rxc/forms-datagrid
//
// Schema-driven DataGrid + Pager renderers that augment `@rxc/forms`. Apps
// that don't render `renderOptions.type === "DataGrid"` / `"Pager"` controls
// need not import this package — its `@astroapps/datagrid` dependency is not
// pulled in by `@rxc/forms`.
//
// Scope: renders columns + rows from the bound array, with column
// filter/sort header controls (driven by a sibling `SearchOptions` control)
// and offset/length paging. Add / remove / edit array actions,
// `groupByField` row-spanning, and per-column visibility expressions are
// not yet ported.

export {
  DataGridRenderType,
  dataGridRegistry,
  dataGridResolveChildren,
  type DataGridOptions,
} from "./DataGrid";
export {
  type ColumnOptions,
  ColumnOptionsType,
  ColumnOptionsFields,
  isColumnAdornment,
  getColumnHeaderFromOptions,
  type DataGridClasses,
  defaultDataGridClasses,
} from "./columnAdornment";
export {
  PagerRenderType,
  pagerPlugin,
  type PagerClasses,
  type PagerOptions,
  defaultPagerClasses,
} from "./Pager";
export { FilterPopover, type FilterPopoverProps } from "./FilterPopover";
export { SortableHeader, type SortableHeaderProps } from "./SortableHeader";
export { Popover, type PopoverProps } from "./Popover";
export { fieldClientSearch, clientSearchPage } from "./clientSearch";
