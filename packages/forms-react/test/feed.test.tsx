import { describe, expect, it } from "vitest";
import { act, type ReactNode } from "react";
import { untrackedRead as rc, type Control } from "@rx-controls/core";
import { Feed, Form, FormProvider } from "../src/index";
import { flush, setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

const dom = setupDom();

function mount(ui: ReactNode, disabled = false) {
  dom.mount(
    <FormProvider renderers={testRenderers}>
      <Form disabled={disabled}>{ui}</Form>
    </FormProvider>,
  );
}
const $ = (sel: string) => dom.container.querySelector(sel) as HTMLElement;
const rows = () => [...dom.container.querySelectorAll("[data-row]")].map((r) => r.textContent);
const press = (sel: string) => act(() => $(sel).click());

/** A host that appends batches of two, as ServiceTas's inbox does. */
function host(total: number) {
  const items = { current: undefined as Control<string[]> | undefined };
  let asked = 0;
  let release: (() => void) | undefined;
  const loadMore = () => {
    asked++;
    return new Promise<void>((r) => {
      release = () => {
        const list = items.current!;
        const now = rc.getValue(list) ?? [];
        const next = [...now, ...[0, 1].map((i) => `row ${now.length + i}`)].slice(0, total);
        dom.ctx.update((wc) => wc.setValue(list, next));
        r();
      };
    });
  };
  return {
    items,
    loadMore,
    asked: () => asked,
    release: async () => {
      await act(async () => release!());
      await flush();
    },
  };
}

describe("Feed", () => {
  it("draws its rows, asks for the next batch, and is loading until it arrives", async () => {
    const h = host(10);
    const list = dom.ctx.newControl<string[]>(["row 0", "row 1"]);
    h.items.current = list;
    mount(
      <Feed field={list} hasMore onLoadMore={h.loadMore}>
        {(item) => <span>{rc.getValue(item)}</span>}
      </Feed>,
    );
    expect(rows()).toEqual(["row 0", "row 1"]);
    press("[data-load-more]");
    expect(h.asked()).toBe(1);
    expect($("[data-feed]").hasAttribute("data-loading")).toBe(true);
    await h.release();
    expect(rows()).toEqual(["row 0", "row 1", "row 2", "row 3"]);
    expect($("[data-feed]").hasAttribute("data-loading")).toBe(false);
  });

  it("asks for nothing while loading, once there is no more, or while locked", async () => {
    const h = host(10);
    const list = dom.ctx.newControl<string[]>([]);
    h.items.current = list;
    const hasMore = dom.ctx.newControl(true);
    const ui = (disabled: boolean) =>
      mount(
        <Feed field={list} hasMore={(r) => r.getValue(hasMore)} onLoadMore={h.loadMore}>
          {(item) => <span>{rc.getValue(item)}</span>}
        </Feed>,
        disabled,
      );
    ui(false);
    // Two triggers before the first batch arrives — an end reached twice — ask once.
    act(() => {
      $("[data-load-more]").click();
      $("[data-load-more]").click();
    });
    press("[data-load-more]");
    expect(h.asked()).toBe(1);
    await h.release();
    act(() => dom.ctx.update((wc) => wc.setValue(hasMore, false)));
    press("[data-load-more]");
    expect(h.asked()).toBe(1);
    act(() => dom.ctx.update((wc) => wc.setValue(hasMore, true)));
    ui(true);
    press("[data-load-more]");
    expect(h.asked()).toBe(1);
    ui(false);
    press("[data-load-more]");
    expect(h.asked()).toBe(2);
  });

  it("is loading while the author says so, and asks for nothing then", () => {
    const h = host(10);
    const list = dom.ctx.newControl<string[]>([]);
    h.items.current = list;
    const loading = dom.ctx.newControl(true);
    mount(
      <Feed field={list} hasMore loading={(r) => r.getValue(loading)} onLoadMore={h.loadMore} empty="Nothing">
        {(item) => <span>{rc.getValue(item)}</span>}
      </Feed>,
    );
    expect($("[data-feed]").hasAttribute("data-loading")).toBe(true);
    // Empty only once nothing is loading.
    expect(dom.container.textContent).not.toContain("Nothing");
    press("[data-load-more]");
    expect(h.asked()).toBe(0);
    act(() => dom.ctx.update((wc) => wc.setValue(loading, false)));
    expect(dom.container.textContent).toContain("Nothing");
  });

  it("offers a refresh only when it has one, and refreshes once at a time", async () => {
    const list = dom.ctx.newControl<string[]>(["a"]);
    mount(<Feed field={list}>{(item) => <span>{rc.getValue(item)}</span>}</Feed>);
    expect($("[data-refresh]")).toBeNull();
    let asked = 0;
    let done: () => void = () => {};
    mount(
      <Feed
        field={list}
        hasMore
        onLoadMore={() => void asked++}
        onRefresh={() => {
          asked++;
          return new Promise<void>((r) => (done = r));
        }}
      >
        {(item) => <span>{rc.getValue(item)}</span>}
      </Feed>,
    );
    press("[data-refresh]");
    expect($("[data-feed]").hasAttribute("data-refreshing")).toBe(true);
    press("[data-refresh]");
    // No batch is asked for during a refresh either.
    press("[data-load-more]");
    expect(asked).toBe(1);
    done();
    await flush();
    expect($("[data-feed]").hasAttribute("data-refreshing")).toBe(false);
  });

  it("shows the end of the list once there is no more, and asks nothing with no handler", () => {
    const list = dom.ctx.newControl<string[]>(["a"]);
    mount(
      <Feed field={list} end="That's all">
        {(item) => <span>{rc.getValue(item)}</span>}
      </Feed>,
    );
    expect(dom.container.textContent).toContain("That's all");
    press("[data-load-more]");
  });
});
