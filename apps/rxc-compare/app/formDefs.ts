import type { SchemaField } from "@rxc/forms-core";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";
import MrsDemeritsJson from "./formDefs/MrsDemeritsSummary.json";

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

export const FormDefinitions: Record<string, FormDefinitionEntry> = {
  Fire,
  RWVPVerificationWizard,
  MrsDemeritsSummary,
};
