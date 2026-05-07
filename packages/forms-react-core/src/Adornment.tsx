"use client";

import type { ComponentType, ReactNode } from "react";
import type {
  ControlAdornment,
  FormStateNode,
} from "@rxc/forms-core";

export type AdornmentKind = "label" | "control" | "field";

export interface AdornmentRenderProps<
  A extends ControlAdornment = ControlAdornment,
> {
  adornment: A;
  node: FormStateNode;
  /** The wrapped target — label content, the renderer's output, or the
   * Layout element, depending on `kind`. */
  children: ReactNode;
}

export interface AdornmentRegistration<
  A extends ControlAdornment = ControlAdornment,
> {
  /** Adornment `type` discriminator (`ControlAdornmentType.HelpText`, etc.). */
  type: A["type"];
  kind: AdornmentKind;
  /** Higher = outer wrap. Default 0. */
  priority?: number;
  render: ComponentType<AdornmentRenderProps<A>>;
}

/** Variance escape hatch — registrations are stored as the unspecified
 * `ControlAdornment` form so the array can hold any specific subtype. */
export type AnyAdornmentRegistration = AdornmentRegistration<ControlAdornment>;

/**
 * Wrap a target node by composing adornments.
 *
 * Adornments are sorted ascending by priority then folded inside-out:
 * the array `[A=0, B=1, C=2]` produces `<C><B><A>{target}</A></B></C>`
 * — lowest-priority adornment is closest to the target, highest is the
 * outermost wrap.
 */
export function wrapAdornments(
  adornments: ControlAdornment[],
  registrations: Map<string, AdornmentRegistration>,
  kind: AdornmentKind,
  target: ReactNode,
  node: FormStateNode,
): ReactNode {
  const filtered: Array<{
    adornment: ControlAdornment;
    reg: AdornmentRegistration;
  }> = [];
  for (const adornment of adornments) {
    const reg = registrations.get(adornment.type);
    if (!reg) continue;
    if (reg.kind !== kind) continue;
    filtered.push({ adornment, reg });
  }
  filtered.sort(
    (a, b) => (a.reg.priority ?? 0) - (b.reg.priority ?? 0),
  );
  return filtered.reduce<ReactNode>((wrapped, { adornment, reg }) => {
    const Render = reg.render as ComponentType<AdornmentRenderProps>;
    return (
      <Render adornment={adornment} node={node}>
        {wrapped}
      </Render>
    );
  }, target);
}

/**
 * Build a quick-lookup map keyed by adornment `type` for a list of
 * registrations. Earlier entries shadow later ones — same shadowing rule
 * as `combineRegistries`.
 */
export function indexAdornments(
  registrations: AdornmentRegistration[],
): Map<string, AdornmentRegistration> {
  const map = new Map<string, AdornmentRegistration>();
  for (const reg of registrations) {
    if (!map.has(reg.type)) map.set(reg.type, reg);
  }
  return map;
}
