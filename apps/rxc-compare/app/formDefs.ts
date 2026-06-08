import type { SchemaField } from "@rxc/forms-core";
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

export const FormDefinitions: Record<string, FormDefinitionEntry> = {
  Fire,
  RWVPVerificationWizard,
  MrsDemeritsSummary,
  RWVPRenewalSearch,
};
