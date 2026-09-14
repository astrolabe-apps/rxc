"use client";

import { useReactive, type Rendered } from "@rx-controls/react";
import { isDisplayControl, type CustomDisplay } from "@rx-controls/forms-core";
import { useFormOptions } from "@rx-controls/forms-react-core";
import type { DisplayRendererProps } from "@rx-controls/forms-react-core";

/**
 * Custom display dispatch. Looks up the registered component for the
 * `customId` in `<Form options={{ customDisplays }}>` — the design's
 * replacement for the legacy `customDisplay` callback.
 *
 * Reads through `node.getState(rc).definition` so scripted overrides of
 * `displayData.customId` re-render. The host's custom component still
 * receives `data` so it can read shape-specific fields itself; if those
 * fields are also scripted, the custom component is responsible for
 * routing reads through its own `useReactive()` rc the same way (see
 * `HtmlDisplayRenderer` for the pattern).
 */
export function CustomDisplayRenderer({ node }: DisplayRendererProps): Rendered {
  const { rc, rendered } = useReactive();
  const { customDisplays } = useFormOptions();
  const def = node.getState(rc).definition;
  const d = isDisplayControl(def)
    ? (def.displayData as CustomDisplay)
    : undefined;
  if (!d) return rendered(null);
  const Component = customDisplays?.[d.customId];
  if (!Component) {
    return rendered(
      <div className="text-xs text-amber-600 dark:text-amber-400">
        Unknown custom display: {d.customId}
      </div>
    );
  }
  return rendered(<Component data={d} />);
}
