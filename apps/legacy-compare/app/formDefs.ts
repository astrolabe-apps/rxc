import { FireRegistrationEditSchema } from "./schemas";
import FireJson from "./formDefs/Fire.json";
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

export const FormDefinitions = {
  Fire: Fire,
};
