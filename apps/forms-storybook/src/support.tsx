import { useState, type ReactNode } from "react";
import type { Control } from "@rx-controls/core";
import {
  ControlContextProvider,
  createControlContext,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Action,
  Form,
  FormProvider,
  useValidation,
  type FormRenderers,
  type Presence,
} from "@rx-controls/forms-react";
import {
  defaultHtmlTheme,
  htmlRenderers,
  HtmlThemeProvider,
  tailwindHtmlTheme,
  type HtmlTheme,
} from "@rx-controls/forms-html";
import { muiRenderers } from "@rx-controls/forms-mui";
import { antdRenderers } from "@rx-controls/forms-antd";
import { fluentRenderers } from "@rx-controls/forms-fluent";
import { nativeRenderers } from "@rx-controls/forms-native";

/**
 * The implementations a story can be drawn with — every story is one per
 * implementation, with no story edited. The theme global applies to html only.
 */
export const implementations: Record<string, FormRenderers> = {
  html: htmlRenderers,
  mui: muiRenderers,
  antd: antdRenderers,
  fluent: fluentRenderers,
  // React Native's components through react-native-web — see `nativeWeb`
  // in vitest.config.ts and .storybook/main.ts. Its look needs the app's
  // NativeWind build, so here it is the contract and the structure.
  native: nativeRenderers,
};

/** The html implementation's two shipped themes. */
export const themes: Record<string, HtmlTheme> = {
  default: defaultHtmlTheme,
  tailwind: tailwindHtmlTheme,
};

/** The args every story carries: the `<Form>` scope the story renders in. */
export interface ScopeArgs {
  presence: Presence;
  disabled: boolean;
  readOnly: boolean;
  designMode: boolean;
  clearHidden: boolean;
}

export interface StoryRootProps {
  implementation?: string;
  theme?: string;
  scope: ScopeArgs;
  children: ReactNode;
}

/**
 * What the decorator wraps every story in. A control context per mount, so a
 * story's controls never leak into the next one.
 */
export function StoryRoot({
  implementation = "html",
  theme = "default",
  scope,
  children,
}: StoryRootProps) {
  const [ctx] = useState(createControlContext);
  const renderers = implementations[implementation] ?? htmlRenderers;
  const htmlTheme = themes[theme] ?? defaultHtmlTheme;
  return (
    <ControlContextProvider value={ctx}>
      <FormProvider renderers={renderers}>
        <HtmlThemeProvider theme={htmlTheme}>
          <Form
            presence={scope.presence}
            disabled={scope.disabled}
            readOnly={scope.readOnly}
            designMode={scope.designMode}
            clearHidden={scope.clearHidden}
          >
            {children}
          </Form>
        </HtmlThemeProvider>
      </FormProvider>
    </ControlContextProvider>
  );
}

/** A live readout of a control: value, and whether it is valid and dirty. */
export function Values({ control }: { control: Control<unknown> }): Rendered {
  const { rc, rendered } = useReactive();
  const errors = rc.getErrors(control);
  return rendered(
    <pre
      data-values
      style={{ marginTop: 16, fontSize: 12, background: "#f4f4f5", padding: 8 }}
    >
      {JSON.stringify(rc.getValue(control), null, 2)}
      {"\n"}
      {`valid: ${rc.isValid(control)}  dirty: ${rc.isDirty(control)}`}
      {Object.keys(errors).length > 0 &&
        `\nerrors: ${JSON.stringify(errors)}`}
    </pre>,
  );
}

/**
 * A submit, from inside the form: the root scope's `check()` — settle, touch
 * if invalid, report — and the root's live status beside it.
 */
export function CheckForm(): Rendered {
  const { rc, rendered } = useReactive();
  const root = useValidation().root;
  const [result, setResult] = useState<string>();
  const status = root.pending(rc)
    ? "checking…"
    : root.isValid(rc)
      ? "valid"
      : "invalid";
  return rendered(
    <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
      <Action
        actionId="submit"
        text="Check form"
        variant="primary"
        onClick={async () => {
          const ok = await root.check();
          setResult(ok ? "passed" : "failed — errors shown");
        }}
      />
      <span data-status>
        Form: {status}
        {result && ` · last check ${result}`}
      </span>
    </div>,
  );
}
