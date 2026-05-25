import type { SchemaField } from "@rxc/forms-core";
import FireJson from "./formDefs/Fire.json";
import RWVPJson from "./formDefs/RWVPVerificationWizard.json";

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

export const FormDefinitions: Record<string, FormDefinitionEntry> = {
  Fire,
  RWVPVerificationWizard,
};
