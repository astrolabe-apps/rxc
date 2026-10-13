import { describe, expect, it, vi } from "vitest";
import { createControlContext, untrackedRead } from "@rx-controls/core";
import {
  combineClass,
  getProp,
  lookNames,
  resolveColor,
  resolveStyleTokens,
  splitPortableStyle,
} from "../src/index";

describe("getProp", () => {
  const ctx = createControlContext();
  it("returns a plain value as it is, and undefined for undefined", () => {
    expect(getProp(untrackedRead, 3)).toBe(3);
    expect(getProp(untrackedRead, undefined)).toBeUndefined();
  });
  it("calls a function with the read context", () => {
    expect(getProp(untrackedRead, (rc) => rc === untrackedRead)).toBe(true);
  });
  it("reads a control's current value", () => {
    const c = ctx.newControl("a");
    expect(getProp(untrackedRead, c)).toBe("a");
    ctx.update((wc) => wc.setValue(c, "b"));
    expect(getProp(untrackedRead, c)).toBe("b");
  });
});

describe("looks", () => {
  it("lists a look's names in layering order, whether one or several", () => {
    expect(lookNames("card")).toEqual(["card"]);
    expect(lookNames(["primary", "wide"])).toEqual(["primary", "wide"]);
    expect(lookNames(undefined)).toEqual([]);
  });

  it("resolves a colour token, with an optional tint, and drops one the theme lacks", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const colors = { accent: "#ff0000", short: "#0f0" };
    expect(resolveColor("#123456", colors)).toBe("#123456");
    expect(resolveColor("$accent", colors)).toBe("#ff0000");
    expect(resolveColor("$accent/50", colors)).toBe("rgba(255, 0, 0, 0.5)");
    expect(resolveColor("$short/10", colors)).toBe("rgba(0, 255, 0, 0.1)");
    expect(resolveColor("$nope", colors)).toBeUndefined();
    expect(resolveColor("$nope", colors)).toBeUndefined();
    // reported once, not per use
    expect(warn.mock.calls).toHaveLength(1);
    warn.mockRestore();
  });

  it("resolves the colours in a style and leaves the rest alone", () => {
    expect(
      resolveStyleTokens({ color: "$accent", padding: 4, borderColor: "#abc" }, { accent: "#112233" }),
    ).toEqual({ color: "#112233", padding: 4, borderColor: "#abc" });
  });

  it("splits a style into what styles the box and what styles the words", () => {
    expect(splitPortableStyle({ padding: 4, color: "red", fontSize: 12, gap: 2 })).toEqual({
      box: { padding: 4, gap: 2 },
      text: { color: "red", fontSize: 12 },
    });
    expect(splitPortableStyle(undefined)).toEqual({ box: {}, text: {} });
  });
});

describe("combineClass", () => {
  it("joins two slots that land on one element", () => {
    expect(combineClass("a", "b")).toBe("a b");
  });
  it("lets a replace on the right win outright", () => {
    expect(combineClass("a", { replace: "b" })).toEqual({ replace: "b" });
  });
  it("keeps a replace on the left a replacement, with the right appended", () => {
    expect(combineClass({ replace: "a" }, "b")).toEqual({ replace: "a b" });
  });
  it("passes either side through when the other is absent", () => {
    expect(combineClass(undefined, "b")).toBe("b");
    expect(combineClass("a", undefined)).toBe("a");
  });
});
