import {
  FireRegistrationEditSchema,
  MrsSummaryFormSchema,
  RWVPVerificationWizardFormSchema,
} from "./schemas";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";
import MrsDemeritsJson from "./formDefs/MrsDemeritsSummary.json";
import { ControlDefinition, SchemaField } from "@react-typed-forms/schemas";

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

export const FormDefinitions = {
  Fire,
  RWVPVerificationWizard,
  MrsDemeritsSummary,
} as const;

export type FormDefinitionEntry = (typeof FormDefinitions)[keyof typeof FormDefinitions];
