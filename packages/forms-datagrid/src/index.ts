// Public API for @rxc/forms-datagrid
//
// Schema-driven DataGrid renderer that augments `@rxc/forms`. Apps that
// don't render `renderOptions.type === "DataGrid"` controls need not
// import this package — its `@astroapps/datagrid` dependency is not
// pulled in by `@rxc/forms`.
//
// Display-only scope: renders columns + rows from the bound array. Add /
// remove / edit actions and search / filter / sort wiring are not yet
// ported.

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
