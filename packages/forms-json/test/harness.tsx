import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";
import type { Control } from "@rx-controls/core";
import {
  ControlContextProvider,
  createControlContext,
  type ControlContext,
} from "@rx-controls/react";
import { Form, FormProvider } from "@rx-controls/forms-react";
import { htmlRenderers } from "@rx-controls/forms-html";
import type { ControlDefinition, SchemaField } from "@rx-controls/forms-schema";
import {
  JsonForm,
  type LoaderOptions,
  type LoaderWarning,
} from "../src/index";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

export interface Loaded<T> {
  data: Control<T>;
  warnings: LoaderWarning[];
}

export interface Harness {
  ctx: ControlContext;
  container: HTMLDivElement;
  /**
   * Mount a JSON form through the real html implementation. `controls` are
   * written as the wire format is — plain objects — and cast once here.
   */
  load<T>(
    controls: object[],
    schema: SchemaField[],
    data: T,
    opts?: LoaderOptions & { clearHidden?: boolean },
  ): Loaded<T>;
  /** Everything the test printed to console.error / console.warn. */
  console: string[];
}

export function setupLoader(): Harness {
  const h = { console: [] as string[] } as Harness;
  let root: Root | undefined;
  beforeEach(() => {
    h.console = [];
    for (const level of ["error", "warn"] as const)
      vi.spyOn(console, level).mockImplementation((...a: unknown[]) => {
        h.console.push(a.map(String).join(" "));
      });
    h.ctx = createControlContext();
    h.container = document.createElement("div");
    document.body.appendChild(h.container);
    root = createRoot(h.container);
    h.load = (controls, schema, value, opts = {}) => {
      const { clearHidden, ...loader } = opts;
      const data = h.ctx.newControl(value);
      const loaded = { data, warnings: [] as LoaderWarning[] };
      act(() =>
        root!.render(
          <ControlContextProvider value={h.ctx}>
            <FormProvider renderers={htmlRenderers}>
              <Form clearHidden={clearHidden}>
                <JsonForm
                  {...loader}
                  controls={controls as ControlDefinition[]}
                  schema={schema}
                  data={data}
                  renderWarnings={(ws) => {
                    loaded.warnings = ws;
                    return null;
                  }}
                />
              </Form>
            </FormProvider>
          </ControlContextProvider>,
        ),
      );
      return loaded;
    };
  });
  afterEach(() => {
    act(() => root?.unmount());
    h.container.remove();
    vi.restoreAllMocks();
  });
  return h;
}

/** Let jsonata's promises and the writes they cause land. */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

export function typeInto(el: Element, text: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export const click = (el: Element) => act(() => (el as HTMLElement).click());
