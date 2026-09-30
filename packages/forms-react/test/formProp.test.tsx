import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { Control, ReadContext } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  fieldRenderer,
  Form,
  FormProvider,
  getProp,
  TextDisplay,
  TextField,
  type FieldRenderProps,
  type FormProp,
} from "../src/index";
import { setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

/**
 * A `FormProp` is resolved in the window of the component that consumes it:
 * a contract prop in the boundary's, a widget's own prop in the widget
 * implementation's. That is what lets a derivation change re-render only the
 * thing showing it — and it is what the escaped-read guard polices: resolving
 * through somebody else's `rc` returns a current value, subscribes to
 * nothing, and is reported.
 */
const dom = setupDom();
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));
const $ = (sel: string) => dom.container.querySelector(sel);

let errors: string[];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
    errors.push(a.map(String).join(" "));
  });
});
afterEach(() => vi.restoreAllMocks());

/** A widget with a prop of its own, which arrives unresolved. */
interface BadgeExtra {
  badge?: FormProp<string>;
  /** Resolve `badge` through this `rc` instead of the widget's own. */
  resolveWith?: () => ReadContext;
}
function BadgeImpl(p: FieldRenderProps<string> & BadgeExtra): Rendered {
  const { rc, rendered } = useReactive();
  const badge = getProp(p.resolveWith?.() ?? rc, p.badge);
  return rendered(<b data-badge>{badge}</b>);
}
const Badge = fieldRenderer<string, BadgeExtra>(BadgeImpl);

let authorRenders = 0;
let authorRc: ReadContext;
function Author({
  field,
  source,
  captured,
}: {
  field: Control<string>;
  source: Control<string>;
  captured?: boolean;
}): Rendered {
  const { rc, rendered } = useReactive();
  authorRenders++;
  authorRc = rc;
  return rendered(
    <Form>
      <TextField field={field} id="f" label={(rc) => `Label: ${rc.getValue(source)}`} />
      <TextDisplay text={(rc) => `Text: ${rc.getValue(source)}`} />
      <Badge
        field={field}
        badge={(rc) => `Badge: ${rc.getValue(source)}`}
        resolveWith={captured ? () => authorRc : undefined}
      />
    </Form>,
  );
}

function mount(captured = false) {
  authorRenders = 0;
  const field = dom.ctx.newControl("");
  const source = dom.ctx.newControl("one");
  dom.mount(
    <FormProvider renderers={testRenderers}>
      <Author field={field} source={source} captured={captured} />
    </FormProvider>,
  );
  return { source };
}

describe("FormProp resolution", () => {
  it("resolves a derived contract prop in the boundary's window: the author does not re-render", () => {
    const { source } = mount();
    expect($("[data-label]")!.textContent).toBe("Label: one");
    expect($("[data-text]")!.textContent).toBe("Text: one");
    set(source, "two");
    expect($("[data-label]")!.textContent).toBe("Label: two");
    expect($("[data-text]")!.textContent).toBe("Text: two");
    expect(authorRenders).toBe(1);
    expect(errors).toEqual([]);
  });

  it("passes a widget's own prop through unresolved, for the widget to resolve in its window", () => {
    const { source } = mount();
    expect($("[data-badge]")!.textContent).toBe("Badge: one");
    set(source, "two");
    expect($("[data-badge]")!.textContent).toBe("Badge: two");
    expect(authorRenders).toBe(1);
    expect(errors).toEqual([]);
  });

  it("reports a prop resolved through a captured rc, which then goes stale", () => {
    const { source } = mount(true);
    // Correct once — the read returns a current value...
    expect($("[data-badge]")!.textContent).toBe("Badge: one");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("read through a ReadContext belonging to an enclosing component");
    // ...but nothing subscribed, so it never moves.
    set(source, "two");
    expect($("[data-badge]")!.textContent).toBe("Badge: one");
    expect($("[data-label]")!.textContent).toBe("Label: two");
  });
});
