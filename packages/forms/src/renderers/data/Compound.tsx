"use client";

import { controls } from "@rxc/controls";
import { pickGroupRenderer } from "@rxc/forms-react-core";
import { useRegistry } from "@rxc/forms-react-core";
import type { DataRendererProps } from "@rxc/forms-react-core";

/**
 * A `Compound`-typed data control delegates rendering to the group
 * dispatch. Compound data is a group at heart — the design doc replaces
 * the legacy data ↔ group ping-pong with this one-way delegation.
 */
export const CompoundDelegate = controls<DataRendererProps>(
  "CompoundDelegate",
  ({ node }, { rc }) => {
    const registry = useRegistry();
    const match = pickGroupRenderer(registry.group, node, rc);
    if (!match) return null;
    return <match.component node={node} />;
  },
);
