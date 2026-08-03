"use client";

import { useControls, type Rendered } from "@rxc/controls";
import { pickGroupRenderer } from "@rxc/forms-react-core";
import { useRegistry } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";

/**
 * A `Compound`-typed data control delegates rendering to the group
 * dispatch. Compound data is a group at heart — the design doc replaces
 * the legacy data ↔ group ping-pong with this one-way delegation.
 */
export function CompoundDelegate({ node }: DataRendererProps): Rendered {
  const { rc, rendered } = useControls();
  const registry = useRegistry();
  const match = pickGroupRenderer(registry.group, node, rc);
  if (!match) return rendered(null);
  return rendered(<match.component node={node} />);
}
