"use client";

import {
  DesignModeProvider,
  OptionsProvider,
  RegistryProvider,
} from "@rxc/forms-react-core";
import { Field } from "./Field";
import { LayoutProvider, DefaultLayout } from "./Layout";
import { VisibilityProvider, DefaultVisibility } from "./Visibility";
import { defaultRegistry } from "./builtins";
import type { FormProps } from "./types";

/**
 * Root form renderer. Provides the registry, layout, visibility, and
 * options contexts to the subtree, and renders the supplied
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
  options,
  designMode,
}: FormProps) {
  const reg = registry ?? defaultRegistry();
  const tree = (
    <RegistryProvider value={reg}>
      <OptionsProvider value={options ?? {}}>
        <LayoutProvider value={layout ?? DefaultLayout}>
          <VisibilityProvider value={visibility ?? DefaultVisibility}>
            <Field node={node} />
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
