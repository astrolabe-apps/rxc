// Public API for @rxc/forms-datagrid
//
// Schema-driven DataGrid + Pager renderers that augment `@rxc/forms`. Apps
// that don't render `renderOptions.type === "DataGrid"` / `"Pager"` controls
// need not import this package — its `@astroapps/datagrid` dependency is not
// pulled in by `@rxc/forms`.
//
// Scope: renders columns + rows from the bound array, with column
// filter/sort header controls (driven by a sibling `SearchOptions` control),
// offset/length paging, per-column `visible`/`rowSpan` expressions,
// adjacent-key `groupByField` row-spanning, and add/remove/edit array
// actions. Setting `renderOptions.editExternal: true` stages Add/Edit in a
// modal via `getExternalEdit` (commits on Apply, discards on Cancel).

export {
  DataGridRenderType,
  computeGroupRowSpans,
  dataGridRegistry,
  dataGridResolveChildren,
  getDataGridLengthRange,
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
export {
  fieldClientSearch,
  schemaClientSearch,
  clientSearchPage,
} from "./clientSearch";
