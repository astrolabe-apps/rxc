import { describe, expect, it } from "vitest";
import { createControlContext, noopReadContext } from "@rxc/controls-core";
import {
  createOverrideProxy,
  NoOverride,
  type NestedProxyBuilder,
} from "../src/overrideProxy";

const makeCtx = () => createControlContext();

// The escaped-read warning these tests trip is filtered in test/setup.ts.
describe("createOverrideProxy", () => {
  it("returns base value when no override is set", () => {
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    const target = { name: "Sam", age: 30 };
    const proxy = createOverrideProxy(target, overrides, noopReadContext);
    expect(proxy.name).toBe("Sam");
    expect(proxy.age).toBe(30);
  });

  it("returns the override scalar value when one is set", () => {
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    // Pre-allocate the override field so Object.hasOwn passes and write
    // a scripted value.
    const fname = overrides.fields.name;
    ctx.update((wc) => wc.setValue(fname, "Override"));
    const target = { name: "Sam", age: 30 };
    const proxy = createOverrideProxy(target, overrides, noopReadContext);
    expect(proxy.name).toBe("Override");
    expect(proxy.age).toBe(30);
  });

  it("falls through to base when override value is NoOverride", () => {
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    const fname = overrides.fields.name;
    ctx.update((wc) => wc.setValue(fname, NoOverride));
    const target = { name: "Sam", age: 30 };
    const proxy = createOverrideProxy(target, overrides, noopReadContext);
    expect(proxy.name).toBe("Sam");
  });

  it("nested compound: base fields preserved when only sub-keys are overridden", () => {
    // Regression: previously the override-value branch fired before the
    // nested-builder check, causing a compound override sub-tree
    // (partial keys) to replace the whole compound — clobbering base
    // fields like `renderOptions.type` from custom plugins.
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    // The "renderOptions" sub-control gets a child override for maxStars
    // but its own value remains the partial Record { maxStars: 7 }.
    const renderOptionsOverride = overrides.fields[
      "renderOptions"
    ] as unknown as import("@rxc/controls-core").Control<
      Record<string, unknown>
    >;
    const maxStarsField = renderOptionsOverride.fields.maxStars;
    ctx.update((wc) => wc.setValue(maxStarsField, 7));

    const target = {
      type: "Data",
      field: "rating",
      renderOptions: { type: "Stars", maxStars: 5, label: "rate" },
    };

    const nested = new Map<string, NestedProxyBuilder>();
    nested.set("renderOptions", (childBase, rc) =>
      createOverrideProxy(childBase, renderOptionsOverride, rc),
    );

    const proxy = createOverrideProxy(
      target,
      overrides,
      noopReadContext,
      nested,
    );

    const ro = proxy.renderOptions as {
      type: string;
      maxStars: number;
      label: string;
    };
    // The nested builder must merge the override sub-tree with the base
    // — not replace the whole compound with the partial sub-Record.
    expect(ro.type).toBe("Stars");
    expect(ro.maxStars).toBe(7);
    expect(ro.label).toBe("rate");
  });
});
