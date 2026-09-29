import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";
import {
  ControlContextProvider,
  createControlContext,
  type ControlContext,
} from "@rx-controls/react";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

export interface Mounted {
  ctx: ControlContext;
  container: HTMLDivElement;
  mount(ui: ReactNode): void;
  unmount(): void;
}

/** A fresh control context and root per test, torn down after it. */
export function setupDom(): Mounted {
  const m = {} as Mounted;
  let root: Root | undefined;
  beforeEach(() => {
    m.ctx = createControlContext();
    m.container = document.createElement("div");
    document.body.appendChild(m.container);
    root = createRoot(m.container);
    m.mount = (ui) =>
      act(() =>
        root!.render(
          <ControlContextProvider value={m.ctx}>{ui}</ControlContextProvider>,
        ),
      );
    m.unmount = () => act(() => root!.unmount());
  });
  afterEach(() => {
    try {
      act(() => root?.unmount());
    } catch {
      /* already unmounted */
    }
    m.container.remove();
  });
  return m;
}

/** Let promise continuations and the effects they schedule run. */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}
