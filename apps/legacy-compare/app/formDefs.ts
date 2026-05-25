import {
  FireRegistrationEditSchema,
  RWVPVerificationWizardFormSchema,
} from "./schemas";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";
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

export const FormDefinitions = {
  Fire,
  RWVPVerificationWizard,
} as const;

export type FormDefinitionEntry = (typeof FormDefinitions)[keyof typeof FormDefinitions];
