import {
  buildSchema,
  ControlAdornmentType,
  CustomRenderOptions,
  stringField,
} from "@react-typed-forms/schemas";

export const TopLevelGroupOption: CustomRenderOptions = {
  value: "TopLevelGroup",
  name: "Top Level Group",
  fields: [],
};

export interface ExtendedHelpText {
  helpLabel: string;
  portalHost?: string;
}

export const HelpTextOptions: CustomRenderOptions = {
  value: ControlAdornmentType.HelpText,
  name: "Help Text",
  fields: buildSchema<ExtendedHelpText>({
    helpLabel: stringField("Label"),
    portalHost: stringField("PortalHost (IOS Modal Only)"),
  }),
};

export const HtmlDataRendererOptions: CustomRenderOptions = {
  value: "HtmlRenderer",
  name: "Html Renderer",
};
