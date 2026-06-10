import {
  FireRegistrationEditSchema,
  MrsSummaryFormSchema,
  RWVPRenewalSearchFormSchema,
  RWVPVerificationWizardFormSchema,
} from "./schemas";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";
import MrsDemeritsJson from "./formDefs/MrsDemeritsSummary.json";
import RWVPSearchJson from "./formDefs/RWVPRenewalSearch.json";
import { ControlDefinition, SchemaField } from "@react-typed-forms/schemas";

// Same seed as the rxc compare app (apps/rxc-compare/app/formDefs.ts) so
// the two render identical rows. Twelve listings with varied statuses;
// page size 5 → 3 pages.
export const rwvpRenewalRows: Record<string, unknown>[] = [
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

export const rwvpPageSize = 5;

export const Fire = {
  value: "Fire",
  name: "Fire",
  schema: FireRegistrationEditSchema,
  schemaName: "FireRegistrationEdit",
  defaultConfig: null,
  controls: FireJson.controls as ControlDefinition[],
  config: FireJson.config,
  formFields: FireJson.fields as SchemaField[],
};

export const RWVPVerificationWizard = {
  value: "RWVPVerificationWizard",
  name: "RWVP Verification",
  schema: RWVPVerificationWizardFormSchema,
  schemaName: "RWVPVerificationWizardForm",
  defaultConfig: null,
  controls: RWVPJson.controls as ControlDefinition[],
  config: (RWVPJson as { config?: unknown }).config,
  formFields: RWVPJson.fields as SchemaField[],
};

export const MrsDemeritsSummary = {
  value: "MrsDemeritsSummary",
  name: "MRS Demerits",
  schema: MrsSummaryFormSchema,
  schemaName: "MrsSummaryForm",
  defaultConfig: null,
  controls: MrsDemeritsJson.controls as ControlDefinition[],
  config: (MrsDemeritsJson as { config?: unknown }).config,
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

export const RWVPRenewalSearch = {
  value: "RWVPRenewalSearch",
  name: "RWVP Renewal Search",
  schema: RWVPRenewalSearchFormSchema,
  schemaName: "RWVPRenewalSearchForm",
  defaultConfig: null,
  controls: RWVPSearchJson.controls as ControlDefinition[],
  config: (RWVPSearchJson as { config?: unknown }).config,
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

// Mirror of the rxc compare app's DataGrid scratch form (apps/rxc-compare/
// app/formDefs.ts) so the Phase D parity fixes can be compared side-by-side
// against the published legacy `@astroapps/schemas-datagrid` renderer:
//   • grid-level `#` row-index adornment column
//   • `editExternal` modal Add/Edit (+ buttons disabled while open)
//   • zebra `rowClass` (per-form via the renderer's `gridRowClass`)
//   • `groupByField: "category"` row clustering — legacy auto-reorders here,
//     which is exactly what the rxc `reorderGroups` flag reproduces.
const incidentChildren = [
  { type: "String", field: "category" },
  { type: "Date", field: "date" },
  { type: "Int", field: "severity" },
  { type: "String", field: "description" },
];

const scratchFields = [
  { type: "Compound", field: "incidents", collection: true, children: incidentChildren },
  { type: "Compound", field: "grouped", collection: true, children: incidentChildren },
] as unknown as SchemaField[];

const lcHeaderCellClass =
  "bg-zinc-100 py-2 px-3 font-semibold flex items-center text-sm text-zinc-700";
const lcBodyCellClass = "py-1.5 px-3 flex items-center";

const lcCol = (
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
    { type: "ColumnOptions", title, columnTemplate, headerCellClass: lcHeaderCellClass, bodyCellClass: lcBodyCellClass, ...extra },
  ],
});

const lcRowIndexAdornment = {
  type: "ColumnOptions",
  title: "#",
  rowIndex: true,
  columnTemplate: "auto",
  headerCellClass: lcHeaderCellClass + " justify-center",
  bodyCellClass: lcBodyCellClass + " justify-center text-zinc-400 tabular-nums",
};

const lcDisplay = (text: string) => ({
  type: "Display",
  title: text,
  displayData: { type: "Text", text },
  textClass: "text-sm font-semibold text-zinc-600 mt-4 mb-1",
});

export const DataGridScratch = {
  value: "DataGridScratch",
  name: "DataGrid Scratch (Phase D)",
  schema: undefined as never,
  schemaName: "DataGridScratchForm",
  defaultConfig: null,
  // `contents` keeps the row wrapper from consuming a grid cell. `dg-row` is
  // a plain CSS rule in globals.css that stripes the row's cells — a
  // `display:contents` box paints no background of its own.
  gridRowClass: "contents dg-row",
  controls: [
    lcDisplay(
      "Editable grid — grid-level # column, modal Add/Edit (buttons disable while the dialog is open), zebra rows",
    ),
    {
      type: "Data",
      title: "Incidents",
      field: "incidents",
      hideTitle: true,
      adornments: [lcRowIndexAdornment],
      renderOptions: {
        type: "DataGrid",
        editExternal: true,
        addText: "Add incident",
        editText: "Edit",
        removeText: "Remove",
      },
      children: [
        lcCol("category", "Category", "1fr", "Standard"),
        lcCol("date", "Date", "1fr", "Standard"),
        lcCol("severity", "Severity", "auto", "Standard"),
        lcCol("description", "Description", "2fr", "Standard"),
      ],
    },
    // Sibling modal host (same shape as the rxc app). Bound to the same
    // `incidents` array; `renderType: ArrayElement` routes to the legacy
    // schemas-html ArrayElementRenderer (wired via createDefaultDataRenderer),
    // which reads the grid's staged-edit data and pops the dialog.
    {
      type: "Data",
      field: "incidents",
      hideTitle: true,
      renderOptions: { type: "ArrayElement" },
      children: [
        lcCol("category", "Category", "1fr", "Standard"),
        lcCol("date", "Date", "1fr", "Standard"),
        lcCol("severity", "Severity", "auto", "Standard"),
        lcCol("description", "Description", "2fr", "Standard"),
      ],
    },
    lcDisplay(
      "Read-only grouped grid — groupByField:category clusters rows; Category row-spans per group",
    ),
    {
      type: "Data",
      title: "Grouped events",
      field: "grouped",
      hideTitle: true,
      adornments: [lcRowIndexAdornment],
      renderOptions: {
        type: "DataGrid",
        displayOnly: true,
        groupByField: "category",
      },
      children: [
        lcCol("category", "Category", "1fr", "DisplayOnly", { groupedColumn: true }),
        lcCol("date", "Date", "1fr", "DisplayOnly"),
        lcCol("severity", "Severity", "auto", "DisplayOnly"),
        lcCol("description", "Description", "2fr", "DisplayOnly"),
      ],
    },
  ] as unknown as ControlDefinition[],
  config: undefined,
  formFields: scratchFields,
  sampleData: {
    incidents: [
      { category: "Fire", date: "2024-01-10", severity: 3, description: "Kitchen fire" },
      { category: "Flood", date: "2024-02-02", severity: 2, description: "Burst pipe" },
      { category: "Storm", date: "2024-04-01", severity: 1, description: "Fallen branch" },
    ],
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

export const FormDefinitions = {
  Fire,
  RWVPVerificationWizard,
  MrsDemeritsSummary,
  RWVPRenewalSearch,
  DataGridScratch,
} as const;

export type FormDefinitionEntry = (typeof FormDefinitions)[keyof typeof FormDefinitions];
