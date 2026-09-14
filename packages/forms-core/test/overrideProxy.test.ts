import { describe, expect, it, vi } from "vitest";
import { createControlContext, untrackedRead } from "@rx-controls/core";
import { TrackingReadContext } from "@rx-controls/core/internal";
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
    const proxy = createOverrideProxy(target, overrides, untrackedRead);
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
    const proxy = createOverrideProxy(target, overrides, untrackedRead);
    expect(proxy.name).toBe("Override");
    expect(proxy.age).toBe(30);
  });

  it("falls through to base when override value is NoOverride", () => {
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    const fname = overrides.fields.name;
    ctx.update((wc) => wc.setValue(fname, NoOverride));
    const target = { name: "Sam", age: 30 };
    const proxy = createOverrideProxy(target, overrides, untrackedRead);
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
    ] as unknown as import("@rx-controls/core").Control<
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
      untrackedRead,
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

/**
 * The escaped-read guard, pinned in both directions.
 *
 * Nothing asserted on this before: `test/setup.ts` *suppresses* the warning,
 * so a mistake that stops it firing makes the suite quieter, not redder. That
 * matters because the flag it reads is about to become `isTracking` with its
 * polarity flipped — keeping the wrong literal kills the guard for every
 * consumer, and dropping the wrong `!` floods every tracked read instead.
 * Both mistakes are otherwise invisible.
 *
 * `vi.spyOn` wraps the console.warn that setup.ts already replaced, so the
 * spy sees the call before the filter drops it.
 */
describe("createOverrideProxy escaped-read guard", () => {
  const withOverride = () => {
    const ctx = makeCtx();
    const overrides = ctx.newControl<Record<string, unknown>>({});
    const label = overrides.fields.label;
    ctx.update((wc) => wc.setValue(label, "scripted"));
    return { ctx, overrides };
  };

  it("warns when a scriptable property is read past the tracking window", () => {
    const { overrides } = withOverride();
    const proxy = createOverrideProxy({ label: "base" }, overrides, untrackedRead);
    const warn = vi.spyOn(console, "warn");
    expect(proxy.label).toBe("scripted");
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain(
      "Scripted-override proxy read for",
    );
    warn.mockRestore();
  });

  it("stays silent while the reading scope is still tracking", () => {
    const { overrides } = withOverride();
    const rc = new TrackingReadContext();
    const proxy = createOverrideProxy({ label: "base" }, overrides, rc);
    const warn = vi.spyOn(console, "warn");
    expect(proxy.label).toBe("scripted");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
