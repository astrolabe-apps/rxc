/**
 * Convergence of a legacy `useControlEffect` chain.
 *
 * These assert the **final state**, never when a subscriber ran — code must
 * not depend on the moment a notification is delivered, so neither do the
 * tests. What they do pin is *whether* a link fires at all, which is a
 * dependency question and a real source of bugs:
 *
 *  - a chain of effects feeding each other converges, however the write is
 *    made (element count growing or shrinking, StrictMode, a DOM handler, an
 *    async continuation, inside `groupedChanges`, from inside another
 *    control's subscription listener);
 *  - `.elements` registers a `Structure` dependency only, so replacing an
 *    array with a **same-length** array converges nowhere — it never re-runs.
 *    Also `@react-typed-forms/core@4` behaviour: `ArrayLogic.updateFromValue`
 *    applied `Structure` only on a length change.
 */

import React, { StrictMode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlChange,
  ControlContextProvider,
  getCompatContext,
  groupedChanges,
  newControl,
  useControlEffect,
} from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

interface Node {
  id: number;
}

/**
 * An array write drives a selection, which drives a page object. The page's
 * `slug` is seeded and never written by the chain, so its survival marks a
 * link that never fired.
 */
function mountChain(strict = false) {
  const items = newControl<Node[]>([{ id: 1 }, { id: 2 }]);
  const page = newControl(1);
  const selected = newControl<Node | undefined>(undefined);
  const view = newControl<{ id: number; slug?: string }>({ id: 0 });

  function Comp() {
    useControlEffect(
      () => [page.value, items.elements] as const,
      ([p, els]) => {
        selected.value = els.length ? els[p - 1]?.value : undefined;
      },
      true,
    );
    useControlEffect(
      () => selected.value,
      (n) => {
        view.value = { id: n?.id ?? -1 };
      },
      true,
    );
    return <span />;
  }

  const tree = (
    <ControlContextProvider value={getCompatContext()}>
      <Comp />
    </ControlContextProvider>
  );
  act(() => root.render(strict ? <StrictMode>{tree}</StrictMode> : tree));
  view.value = { id: view.value.id, slug: "stale" };
  return { items, page, selected, view };
}

for (const strict of [false, true]) {
  const tag = strict ? "StrictMode" : "non-strict";

  describe(`legacy useControlEffect chain converges (${tag})`, () => {
    it("element count grows", async () => {
      const s = mountChain(strict);
      await act(async () => {
        s.items.value = [{ id: 7 }, { id: 8 }, { id: 9 }];
      });
      expect(s.view.value).toEqual({ id: 7 });
    });

    it("element count shrinks", async () => {
      const s = mountChain(strict);
      await act(async () => {
        s.items.value = [{ id: 7 }];
      });
      expect(s.view.value).toEqual({ id: 7 });
    });

    it("from a DOM event handler", async () => {
      const s = mountChain(strict);
      await act(async () => {
        const btn = document.createElement("button");
        btn.onclick = () => {
          s.items.value = [{ id: 7 }, { id: 8 }, { id: 9 }];
        };
        btn.click();
      });
      expect(s.view.value).toEqual({ id: 7 });
    });

    it("from an async continuation", async () => {
      const s = mountChain(strict);
      await act(async () => {
        await Promise.resolve();
        s.items.value = [{ id: 7 }, { id: 8 }, { id: 9 }];
      });
      expect(s.view.value).toEqual({ id: 7 });
    });

    it("inside groupedChanges", async () => {
      const s = mountChain(strict);
      await act(async () => {
        groupedChanges(() => {
          s.items.value = [{ id: 7 }, { id: 8 }, { id: 9 }];
        });
      });
      expect(s.view.value).toEqual({ id: 7 });
    });

    it("from inside another control's subscription listener", async () => {
      const s = mountChain(strict);
      const trigger = newControl(0);
      trigger.subscribe(() => {
        s.items.value = [{ id: 7 }, { id: 8 }, { id: 9 }];
      }, ControlChange.Value);

      await act(async () => {
        trigger.value = 1;
      });
      expect(s.view.value).toEqual({ id: 7 });
    });
  });
}

describe("legacy `.elements` depends on structure, not contents", () => {
  it("a same-length array replacement never re-runs the chain", async () => {
    const s = mountChain();
    act(() => {
      s.items.value = [{ id: 7 }, { id: 8 }];
    });
    // Not merely late — no re-render or timer brings it in either.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(s.view.value).toEqual({ id: 1, slug: "stale" });
  });

  it("reading the elements' values instead does converge", async () => {
    const items = newControl<Node[]>([{ id: 1 }, { id: 2 }]);
    const view = newControl<{ id: number; slug?: string }>({ id: 0 });
    function Comp() {
      useControlEffect(
        () => items.elements.map((e) => e.value),
        (vs) => {
          view.value = { id: vs[0]?.id ?? -1 };
        },
        true,
      );
      return <span />;
    }
    act(() =>
      root.render(
        <ControlContextProvider value={getCompatContext()}>
          <Comp />
        </ControlContextProvider>,
      ),
    );
    view.value = { id: view.value.id, slug: "stale" };

    await act(async () => {
      items.value = [{ id: 7 }, { id: 8 }];
    });
    expect(view.value).toEqual({ id: 7 });
  });
});
