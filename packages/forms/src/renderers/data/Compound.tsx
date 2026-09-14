"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import { pickGroupRenderer } from "@rx-controls/forms-react-core";
import { useRegistry } from "@rx-controls/forms-react-core";
import type { DataRendererProps } from "@rx-controls/forms-react-core";

/**
 * A `Compound`-typed data control delegates rendering to the group
 * dispatch. Compound data is a group at heart — the design doc replaces
 * the legacy data ↔ group ping-pong with this one-way delegation.
 */
export function CompoundDelegate({ node }: DataRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const registry = useRegistry();
  const match = pickGroupRenderer(registry.group, node, rc);
  if (!match) return rendered(null);
  return rendered(<match.component node={node} />);
}
