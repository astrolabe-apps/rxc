import type { FormRenderers, VisibilityProps } from "@rx-controls/forms-react";
import type { Rendered } from "@rx-controls/react";
import { notBuiltComponent } from "./notBuilt.js";

/**
 * The HTML implementation: every registry slot, drawn as plain DOM and styled
 * through {@link HtmlTheme}. Pass it to `FormProvider`, or spread it and
 * replace a slot: `{ ...htmlRenderers, visibility: DefaultVisibility }`.
 *
 * @group Rendering
 */
export const htmlRenderers: FormRenderers = new Proxy({} as FormRenderers, {
  get: (_, slot) =>
    slot === "name"
      ? "html"
      : notBuiltComponent(`htmlRenderers.${String(slot)}`),
});

/**
 * A `visibility` slot that mounts and unmounts at once, with no transition.
 *
 * @group Rendering
 */
export const DefaultVisibility: (props: VisibilityProps) => Rendered =
  notBuiltComponent<VisibilityProps>("DefaultVisibility");

/**
 * A `visibility` slot that fades content out before unmounting it: the
 * content stays mounted for the length of the transition. The default in
 * {@link htmlRenderers}.
 *
 * @group Rendering
 */
export const FadeVisibility: (props: VisibilityProps) => Rendered =
  notBuiltComponent<VisibilityProps>("FadeVisibility");
