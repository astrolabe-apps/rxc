import { buildSchema, stringField, ControlAdornmentType } from "@rx-controls/forms-core";

// String constants for custom renderType / adornmentType values referenced in Fire.json.
// In the new lib these are not separate registration kinds — they're just the matcher's
// renderType string. Schemas (for editor / scripted overrides) are plumbed via plugin specs.
export const TopLevelGroupValue = "TopLevelGroup";

export interface ExtendedHelpText {
  helpLabel: string;
  portalHost?: string;
}

export const HelpTextSchemaFields = buildSchema<ExtendedHelpText>({
  helpLabel: stringField("Label"),
  portalHost: stringField("PortalHost (IOS Modal Only)"),
});

export const HelpTextAdornmentValue = ControlAdornmentType.HelpText;

export const HtmlDataRendererValue = "HtmlRenderer";
