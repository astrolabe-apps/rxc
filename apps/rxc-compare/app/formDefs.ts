import { FieldType, type SchemaField } from "@rxc/forms-core";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";
import MrsDemeritsJson from "./formDefs/MrsDemeritsSummary.json";
import RWVPSearchJson from "./formDefs/RWVPRenewalSearch.json";

export interface FormDefinitionEntry {
  /** Stable key + dropdown value. */
  key: string;
  /** Display name shown in the heading + dropdown option. */
  name: string;
  /** Schema name to resolve in `SchemaMap`. */
  schemaName: string;
  /** Top-level control definitions for the form. */
  controls: unknown[];
  /** Per-form-bundled schema fields (matches the same name in `SchemaMap`). */
  formFields: SchemaField[];
  /** Optional initial form data so display-only forms have something to show. */
  sampleData?: Record<string, unknown>;
  /**
   * When present, the page wires a client-side search effect: the bound
   * `results.{entries,total}` are recomputed from `allRows` + the form's
   * `request` SearchOptions (filter/sort/page), standing in for a server.
   * `searchableFields` enables the full-text `query` box — values from
   * those row fields are concatenated and matched case-insensitively.
   */
  clientSearch?: {
    allRows: Record<string, unknown>[];
    searchableFields?: string[];
  };
  /**
   * When set, the page builds this form's registry with the given DataGrid
   * `rowClass` — the only DataGrid class slot that's renderer-construction
   * time rather than per-form JSON. Used by the scratch form to exercise the
   * `wrapBodyRow` row-class path.
   */
  gridRowClass?: string;
}

export const Fire: FormDefinitionEntry = {
  key: "Fire",
  name: "Fire",
  schemaName: "FireRegistrationEdit",
  controls: FireJson.controls,
  formFields: FireJson.fields as SchemaField[],
};

export const RWVPVerificationWizard: FormDefinitionEntry = {
  key: "RWVPVerificationWizard",
  name: "RWVP Verification",
  schemaName: "RWVPVerificationWizardForm",
  controls: RWVPJson.controls,
  formFields: RWVPJson.fields as SchemaField[],
};

export const MrsDemeritsSummary: FormDefinitionEntry = {
  key: "MrsDemeritsSummary",
  name: "MRS Demerits",
  schemaName: "MrsSummaryForm",
  controls: MrsDemeritsJson.controls,
  formFields: MrsDemeritsJson.fields as SchemaField[],
  sampleData: {
    demerits: {
      totalPoints: 7,
      activePoints: 4,
      details: [
        { points: 3, offenceDate: "2024-01-12", description: "Exceed speed limit by less than 15 km/h" },
        { points: 3, offenceDate: "2024-03-02", description: "Use mobile phone while driving" },
        { points: 1, offenceDate: "2024-05-21", description: "Fail to display P plates" },
      ],
    },
  },
};

// Twelve renewal listings with varied statuses so the Status filter and
// offset/length paging are both exercised (page size 5 → 3 pages).
const rwvpRenewalRows: Record<string, unknown>[] = [
  { id: "1", firstName: "Ava", lastName: "Nguyen", dateOfBirth: "1990-04-11", status: "Submitted", registrationNumber: "RN-1001", expiryDate: "2026-01-15", licenceNumber: "L-3001", submitAt: "2025-11-01T09:24:00" },
  { id: "2", firstName: "Liam", lastName: "Brown", dateOfBirth: "1985-09-02", status: "Draft", registrationNumber: "RN-1002", expiryDate: "2026-02-20", licenceNumber: "L-3002", submitAt: null },
  { id: "3", firstName: "Mia", lastName: "Wilson", dateOfBirth: "1992-12-23", status: "Completed", registrationNumber: "RN-1003", expiryDate: "2025-12-31", licenceNumber: "L-3003", submitAt: "2025-10-18T14:02:00" },
  { id: "4", firstName: "Noah", lastName: "Taylor", dateOfBirth: "1978-06-30", status: "WaitingForCustomer", registrationNumber: "RN-1004", expiryDate: "2026-03-05", licenceNumber: "L-3004", submitAt: "2025-11-09T11:47:00" },
  { id: "5", firstName: "Emma", lastName: "Davies", dateOfBirth: "1995-01-19", status: "Submitted", registrationNumber: "RN-1005", expiryDate: "2026-04-12", licenceNumber: "L-3005", submitAt: "2025-11-12T08:15:00" },
  { id: "6", firstName: "Oliver", lastName: "Martin", dateOfBirth: "1988-08-08", status: "Completed", registrationNumber: "RN-1006", expiryDate: "2025-11-28", licenceNumber: "L-3006", submitAt: "2025-09-30T16:33:00" },
  { id: "7", firstName: "Sophia", lastName: "Lee", dateOfBirth: "2000-03-14", status: "CompleteOffline", registrationNumber: "RN-1007", expiryDate: "2026-05-01", licenceNumber: "L-3007", submitAt: "2025-10-05T10:10:00" },
  { id: "8", firstName: "Jack", lastName: "Walker", dateOfBirth: "1983-11-27", status: "Draft", registrationNumber: "RN-1008", expiryDate: "2026-01-09", licenceNumber: "L-3008", submitAt: null },
  { id: "9", firstName: "Isla", lastName: "Harris", dateOfBirth: "1997-07-07", status: "Submitted", registrationNumber: "RN-1009", expiryDate: "2026-02-02", licenceNumber: "L-3009", submitAt: "2025-11-14T13:21:00" },
  { id: "10", firstName: "Lucas", lastName: "Clark", dateOfBirth: "1991-05-05", status: "WaitingForCustomer", registrationNumber: "RN-1010", expiryDate: "2026-06-18", licenceNumber: "L-3010", submitAt: "2025-11-03T09:00:00" },
  { id: "11", firstName: "Grace", lastName: "Evans", dateOfBirth: "1986-10-21", status: "Completed", registrationNumber: "RN-1011", expiryDate: "2025-12-15", licenceNumber: "L-3011", submitAt: "2025-10-22T15:45:00" },
  { id: "12", firstName: "Henry", lastName: "King", dateOfBirth: "1999-02-28", status: "Submitted", registrationNumber: "RN-1012", expiryDate: "2026-03-30", licenceNumber: "L-3012", submitAt: "2025-11-15T07:55:00" },
];

const rwvpPageSize = 5;

export const RWVPRenewalSearch: FormDefinitionEntry = {
  key: "RWVPRenewalSearch",
  name: "RWVP Renewal Search",
  schemaName: "RWVPRenewalSearchForm",
  controls: RWVPSearchJson.controls,
  formFields: RWVPSearchJson.fields as SchemaField[],
  sampleData: {
    request: {
      from: null,
      to: null,
      query: null,
      offset: 0,
      length: rwvpPageSize,
      sort: [],
      filters: {},
    },
    results: {
      total: rwvpRenewalRows.length,
      entries: rwvpRenewalRows.slice(0, rwvpPageSize),
    },
  },
  clientSearch: {
    allRows: rwvpRenewalRows,
    searchableFields: [
      "firstName",
      "lastName",
      "registrationNumber",
      "licenceNumber",
      "status",
    ],
  },
};

// ---------------------------------------------------------------------------
// DataGrid scratch form — exercises the Phase D parity fixes for a visual pass:
//   • grid-level `#` row-index adornment column (synthetic leading column)
//   • `editExternal` modal Add/Edit + Add/Edit/Remove disabled while open
//   • zebra `rowClass` via the grid registry's `wrapBodyRow`
//   • `groupByField` + `reorderGroups` clustering (read-only second grid)
// ---------------------------------------------------------------------------

const incidentChildren: SchemaField[] = [
  { type: FieldType.String, field: "category" },
  { type: FieldType.Date, field: "date" },
  { type: FieldType.Int, field: "severity" },
  { type: FieldType.String, field: "description" },
];

const scratchFields: SchemaField[] = [
  {
    type: FieldType.Compound,
    field: "incidents",
    collection: true,
    children: incidentChildren,
  } as SchemaField,
  {
    type: FieldType.Compound,
    field: "grouped",
    collection: true,
    children: incidentChildren,
  } as SchemaField,
];

const headerCellClass =
  "bg-zinc-100 py-2 px-3 font-semibold flex items-center text-sm text-zinc-700";
const bodyCellClass = "py-1.5 px-3 flex items-center";

const dgCol = (
  field: string,
  title: string,
  columnTemplate: string,
  renderType: "DisplayOnly" | "Standard",
  extra: Record<string, unknown> = {},
) => ({
  type: "Data",
  title,
  field,
  hideTitle: true,
  renderOptions: { type: renderType },
  adornments: [
    {
      type: "ColumnOptions",
      title,
      columnTemplate,
      headerCellClass,
      bodyCellClass,
      ...extra,
    },
  ],
});

// A `ColumnOptions` adornment placed on the grid control itself (not a child
// control) — synthesizes the standalone leading "#" row-index column.
const rowIndexAdornment = {
  type: "ColumnOptions",
  title: "#",
  rowIndex: true,
  columnTemplate: "auto",
  headerCellClass: headerCellClass + " justify-center",
  bodyCellClass: bodyCellClass + " justify-center text-zinc-400 tabular-nums",
};

const display = (text: string) => ({
  type: "Display",
  title: text,
  displayData: { type: "Text", text },
  textClass: "text-sm font-semibold text-zinc-600 mt-4 mb-1",
});

export const DataGridScratch: FormDefinitionEntry = {
  key: "DataGridScratch",
  name: "DataGrid Scratch (Phase D)",
  schemaName: "DataGridScratchForm",
  formFields: scratchFields,
  // `contents` keeps the row wrapper from consuming a grid cell (its cells
  // re-promote to grid items). `dg-row` is a plain CSS rule in globals.css
  // that stripes the row's cells — a `display:contents` box paints no
  // background of its own, so the zebra must target the cells.
  gridRowClass: "contents dg-row",
  controls: [
    display(
      "Editable grid — grid-level # column, modal Add/Edit (buttons disable while the dialog is open), zebra rows",
    ),
    {
      type: "Data",
      title: "Incidents",
      field: "incidents",
      hideTitle: true,
      adornments: [rowIndexAdornment],
      renderOptions: {
        type: "DataGrid",
        editExternal: true,
        addText: "Add incident",
        editText: "Edit",
        removeText: "Remove",
      },
      children: [
        dgCol("category", "Category", "1fr", "Standard"),
        dgCol("date", "Date", "1fr", "Standard"),
        dgCol("severity", "Severity", "auto", "Standard"),
        dgCol("description", "Description", "2fr", "Standard"),
      ],
    },
    display(
      "Read-only grouped grid — groupByField:category + reorderGroups clusters rows on mount; Category row-spans per group",
    ),
    {
      type: "Data",
      title: "Grouped events",
      field: "grouped",
      hideTitle: true,
      adornments: [rowIndexAdornment],
      renderOptions: {
        type: "DataGrid",
        displayOnly: true,
        groupByField: "category",
        reorderGroups: true,
      },
      children: [
        dgCol("category", "Category", "1fr", "DisplayOnly", {
          groupedColumn: true,
        }),
        dgCol("date", "Date", "1fr", "DisplayOnly"),
        dgCol("severity", "Severity", "auto", "DisplayOnly"),
        dgCol("description", "Description", "2fr", "DisplayOnly"),
      ],
    },
  ],
  sampleData: {
    incidents: [
      { category: "Fire", date: "2024-01-10", severity: 3, description: "Kitchen fire" },
      { category: "Flood", date: "2024-02-02", severity: 2, description: "Burst pipe" },
      { category: "Storm", date: "2024-04-01", severity: 1, description: "Fallen branch" },
    ],
    // Deliberately out of category order so reorderGroups visibly clusters.
    grouped: [
      { category: "Fire", date: "2024-01-10", severity: 3, description: "Kitchen fire" },
      { category: "Flood", date: "2024-02-02", severity: 2, description: "Burst pipe" },
      { category: "Fire", date: "2024-03-15", severity: 5, description: "Electrical fire" },
      { category: "Storm", date: "2024-04-01", severity: 1, description: "Fallen branch" },
      { category: "Flood", date: "2024-05-20", severity: 4, description: "River overflow" },
      { category: "Fire", date: "2024-06-30", severity: 2, description: "Bin fire" },
    ],
  },
};

export const FormDefinitions: Record<string, FormDefinitionEntry> = {
  Fire,
  RWVPVerificationWizard,
  MrsDemeritsSummary,
  RWVPRenewalSearch,
  DataGridScratch,
};
