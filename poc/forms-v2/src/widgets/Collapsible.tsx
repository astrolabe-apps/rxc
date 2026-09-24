import { useState, type ReactNode } from "react";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  groupRenderer,
  getProp,
  mergeClass,
  useFormScope,
  useRenderers,
  type FormProp,
  type GroupRenderProps,
} from "../framework/index.js";

export interface CollapsibleExtra {
  /** A renderer-specific plain value. */
  defaultOpen?: boolean;
  /** A renderer-specific *reactive* value: shown in the header while collapsed. */
  summary?: FormProp<ReactNode>;
}

/**
 * A third-party **group** renderer — the last boundary kind not yet written
 * from outside the package. Imports no UI library. A disclosure section: a
 * header the user toggles, an invalid badge on it while the content is off
 * screen (the boundary was built with `{ scope: true }`), and a live summary
 * of what is inside.
 *
 * Two rules it has to keep that nothing enforces (README finding 55):
 *
 *  - **Collapsed is not hidden.** The children stay mounted and keep
 *    validating; only the boundary's `hidden` — the scope's presence — may
 *    stop that, and it does so through the fields' own boundaries. A group
 *    that unmounted its collapsed content would drop every validator under
 *    it and clear nothing, the `<Activity>` failure from finding 25.
 *  - **Never change the element at a position.** The header, the body and
 *    the wrapper are always the same elements; open/closed and hidden are
 *    attributes on them (findings 17 and 22).
 *
 * The body is the implementation's own `contents` renderer, resolved from the
 * registry — so this widget gets the implementation's collapse treatment
 * (grid-rows transition, `inert`) without importing it, the way `Stars` gets a
 * shell. Design mode forces it open: the goals doc's layer 2 "all expanded"
 * substitution, opted into by the renderer in one line since no dispatcher
 * table has heard of it (layer 3).
 */
function CollapsibleImpl(p: GroupRenderProps & CollapsibleExtra): Rendered {
  const { rc, rendered } = useReactive();
  const Body = useRenderers().contents;
  const { designMode } = useFormScope();
  const [open, setOpen] = useState(p.defaultOpen ?? true);
  const shown = open || designMode;
  const summary = getProp(rc, p.summary);
  return rendered(
    <section
      className={mergeClass("ff-collapsible", p.className)}
      data-hidden={p.hidden ? "" : undefined}
      data-invalid={p.invalid ? "" : undefined}
      inert={p.hidden || undefined}
    >
      <button
        type="button"
        className="ff-collapsible-head"
        aria-expanded={shown}
        onClick={() => {
          if (!designMode) setOpen((o) => !o);
        }}
      >
        <span className="ff-collapsible-chevron" aria-hidden>
          {shown ? "▾" : "▸"}
        </span>
        <span className="ff-collapsible-title">{p.title}</span>
        {!shown && summary != null && (
          <span className="ff-collapsible-summary">{summary}</span>
        )}
        {p.invalid && (
          <span className="ff-collapsible-badge" title="Contains errors">
            !
          </span>
        )}
      </button>
      <Body hidden={!shown}>{p.children}</Body>
    </section>,
  );
}

export const Collapsible = groupRenderer<CollapsibleExtra>(CollapsibleImpl, {
  scope: true,
});
