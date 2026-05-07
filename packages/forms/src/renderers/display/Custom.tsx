"use client";

import { useFormOptions } from "@rxc/forms-react-core";
import type { CustomDisplay } from "@rxc/forms-core";
import type { DisplayRendererProps } from "@rxc/forms-react-core";

/**
 * Custom display dispatch. Looks up the registered component for the
 * `customId` in `<Form options={{ customDisplays }}>` — the design's
 * replacement for the legacy `customDisplay` callback.
 */
export function CustomDisplayRenderer({ data }: DisplayRendererProps) {
  const { customDisplays } = useFormOptions();
  const d = data as CustomDisplay;
  const Component = customDisplays?.[d.customId];
  if (!Component) {
    return (
      <div className="text-xs text-amber-600 dark:text-amber-400">
        Unknown custom display: {d.customId}
      </div>
    );
  }
  return <Component data={data} />;
}
