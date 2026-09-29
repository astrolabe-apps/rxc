import { useMemo, type ReactNode } from "react";
import jsonata from "jsonata";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  FormScopeProvider,
  getProp,
  narrowScope,
  useFormScope,
  type FormProp,
  type Presence,
} from "../framework/index.js";

/**
 * Legacy's `LayoutStyle` is an inline style on the layout element, computed by
 * an expression. The corpus has 15, in two shapes, and neither is a style:
 *
 *  - **13 toggle `{ display: "none" }`** on a payment method, over sections
 *    holding QuickstreamCC / QuickstreamPay iframes. That is "off screen, still
 *    mounted, still validating, never cleared" — which is `silent`, and legacy
 *    got exactly those semantics for free because it never knew the node was
 *    hidden at all.
 *  - **2 set a border colour while an accordion is expanded**, and already
 *    branch on `$platform` to write CSS keys on web and RN keys on native. That
 *    is theme styling of group state, not something a form should carry.
 *
 * So the loader recognises the first statically — every object the expression
 * can produce is `{}` or `{ display: "none" }` — and reports anything else.
 * Static rather than at run time so the verdict is a translate-time warning,
 * like every other one, instead of a style that turns up on the third click.
 */
export function displayToggle(expression: string): boolean {
  let ast: unknown;
  try {
    ast = jsonata(expression).ast();
  } catch {
    return false;
  }
  let objects = 0;
  let ok = true;
  const walk = (n: unknown): void => {
    if (!ok || n === null || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    const node = n as Record<string, unknown>;
    if (node.type === "unary" && node.value === "{") {
      objects++;
      for (const pair of node.lhs as [
        Record<string, unknown>,
        Record<string, unknown>,
      ][]) {
        const [k, v] = pair;
        if (
          k.type !== "string" ||
          k.value !== "display" ||
          v.type !== "string" ||
          v.value !== "none"
        )
          ok = false;
      }
      return;
    }
    for (const v of Object.values(node)) walk(v);
  };
  walk(ast);
  return ok && objects > 0;
}

/**
 * The container the loader wraps a display-toggled node in. Written as a third
 * party, the way `SelectChild` is: `narrowScope` + `FormScopeProvider` and an
 * unchanging wrapper that hides itself (findings 17, 22, 26, 57).
 *
 * `display: contents` while shown, so the wrapper is invisible to a flex or
 * grid parent — legacy put the style on the layout element itself and added
 * nothing.
 */
export function Offscreen({
  off,
  children,
}: {
  /** `true` → `silent`. Pending (`undefined`) is shown, as in legacy. */
  off: FormProp<boolean | undefined>;
  children: ReactNode;
}): Rendered {
  const { rc, rendered } = useReactive();
  const parent = useFormScope();
  const isOff = !parent.designMode && (getProp(rc, off) ?? false);
  const presence: Presence = isOff ? "silent" : "rendered";
  const scope = useMemo(
    () => narrowScope(parent, { presence: () => presence }),
    [parent, presence],
  );
  return rendered(
    <div
      className="ff-offscreen"
      hidden={isOff}
      style={isOff ? undefined : { display: "contents" }}
    >
      <FormScopeProvider scope={scope}>{children}</FormScopeProvider>
    </div>,
  );
}
