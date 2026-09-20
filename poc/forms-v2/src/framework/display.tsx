import { type ComponentType } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import { useBoundScope } from "./boundary.js";
import { getProp, getProps } from "./prop.js";
import { useRenderers } from "./renderers.js";
import type {
  DisplayProps,
  DisplayRenderProps,
  FormRenderers,
  Resolved,
} from "./types.js";

export type DisplayImplSource<P extends object> =
  | ComponentType<DisplayRenderProps & Resolved<P>>
  | { key: keyof FormRenderers };

const contractKeys = new Set([
  "hidden",
  "accessibleName",
  "className",
  "textClassName",
  "children",
]);

/**
 * The display boundary. Useful mostly for what it *doesn't* do: with no
 * binding there is no field to validate, nothing to clear when hidden, and no
 * `state(rc)` to fold the locks into. What survives is presence, the class
 * slots, the `visibility` slot and design chrome — which is the part of a
 * boundary that was never about data.
 */
export function displayRenderer<P extends object = {}>(
  source: DisplayImplSource<P>,
): ComponentType<DisplayProps & P> {
  function DisplayBoundary(props: DisplayProps & P): Rendered {
    const { rc, rendered } = useReactive();
    const renderers = useRenderers();
    const scope = useBoundScope(props);
    const presenceNow = scope.presence(rc);

    const extra: Record<string, unknown> = {};
    for (const k of Object.keys(props))
      if (!contractKeys.has(k))
        extra[k] = (props as Record<string, unknown>)[k];

    const Impl = (
      "key" in source
        ? (renderers[source.key] as ComponentType<unknown>)
        : source
    ) as ComponentType<Record<string, unknown>>;
    const Visibility = renderers.visibility;

    return rendered(
      <div
        className="ff-boundary"
        data-design={scope.designMode ? "" : undefined}
      >
        <Visibility visible={presenceNow === "rendered"}>
          <Impl
            accessibleName={getProp(rc, props.accessibleName)}
            className={getProp(rc, props.className)}
            textClassName={getProp(rc, props.textClassName)}
            {...getProps(rc, extra)}
          >
            {props.children}
          </Impl>
        </Visibility>
      </div>,
    );
  }
  DisplayBoundary.displayName = `DisplayBoundary(${
    "key" in source ? source.key : (source.displayName ?? source.name)
  })`;
  return DisplayBoundary as ComponentType<DisplayProps & P>;
}
