"use client";

import {
  DesignModeProvider,
  OptionsProvider,
  RegistryProvider,
  type FormRegistry,
} from "@rx-controls/forms-react-core";
import { Field } from "./Field";
import { LayoutProvider, DefaultLayout } from "./Layout";
import { VisibilityProvider, DefaultVisibility } from "./Visibility";
import { LabelProvider, DefaultLabel } from "./Label";
import { ErrorProvider, DefaultError } from "./Error";
import { defaultRegistry } from "./builtins";
import type { FormProps } from "./types";
import type { HtmlFormOptions } from "./theme";

// Stable fallbacks for a `<Form>` rendered without `registry` / `options`.
// This isn't about context re-renders — the subtree re-renders top-down
// whenever Form does, regardless. It avoids (a) rebuilding the whole matcher
// registry on every render, and (b) handing downstream `useMemo`s keyed on
// registry identity (e.g. `collectExtraRenderOptionFields`) a fresh object
// each render. The default registry is stateless config, so one shared
// instance is safe.
const EMPTY_OPTIONS: HtmlFormOptions = {};
let sharedDefaultRegistry: FormRegistry | undefined;

/**
 * Root form renderer. Provides the registry, layout, visibility, label,
 * error, and options contexts to the subtree, and renders the supplied
 * `FormStateNode` via `<Field>`.
 *
 * Build the FormStateNode separately (e.g. with `useFormStateNode`) and
 * pass it via `node` — Form itself does not construct it, so callers
 * keep direct access for inspection, validation, etc.
 */
export function Form({
  node,
  registry,
  layout,
  visibility,
  label,
  error,
  options,
  designMode,
}: FormProps) {
  const reg = registry ?? (sharedDefaultRegistry ??= defaultRegistry());
  const tree = (
    <RegistryProvider value={reg}>
      <OptionsProvider value={options ?? EMPTY_OPTIONS}>
        <LayoutProvider value={layout ?? DefaultLayout}>
          <VisibilityProvider value={visibility ?? DefaultVisibility}>
            <LabelProvider value={label ?? DefaultLabel}>
              <ErrorProvider value={error ?? DefaultError}>
                <Field node={node} />
              </ErrorProvider>
            </LabelProvider>
          </VisibilityProvider>
        </LayoutProvider>
      </OptionsProvider>
    </RegistryProvider>
  );
  return designMode === undefined ? (
    tree
  ) : (
    <DesignModeProvider value={designMode}>{tree}</DesignModeProvider>
  );
}
