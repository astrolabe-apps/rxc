"use client";

import { pickActionRenderer } from "./registry";
import type { ActionRendererProps } from "./types";
import { useRegistry } from "./FormProvider";

/**
 * Render a single action through the registry's action matchers.
 *
 * Looks up the component via `pickActionRenderer` (host registrations
 * via `matchActionId(id, MyRenderer)` win over the default action
 * renderer) and renders it with the supplied props. Returns `null` if
 * no matcher claims the action — typically only happens when the host
 * has cleared the default `matchActionAlways(ButtonAction)` entry.
 *
 * Used by `<Field>` to render form-tree action controls (after adapting
 * the `FormStateNode` to plain props) and by data renderers that need
 * inline action buttons (e.g. an Array renderer's Add / Edit / Remove,
 * a Pager's Previous / Next) — anywhere a host-overridable button
 * should appear without synthesizing a `FormStateNode`.
 */
export function Action(props: ActionRendererProps) {
  const registry = useRegistry();
  const match = pickActionRenderer(registry.action, props);
  if (!match) return null;
  const Component = match.component;
  return <Component {...props} />;
}
