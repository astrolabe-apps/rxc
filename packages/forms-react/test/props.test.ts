import { describe, expect, it } from "vitest";
import { createControlContext, untrackedRead } from "@rx-controls/core";
import { combineClass, getProp, mergeClass } from "../src/index";

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

describe("mergeClass", () => {
  it("appends a string to the implementation's own class", () => {
    expect(mergeClass("own", "extra")).toBe("own extra");
  });
  it("replaces it with { replace }", () => {
    expect(mergeClass("own", { replace: "mine" })).toBe("mine");
  });
  it("keeps the own class when nothing is given, and drops empties", () => {
    expect(mergeClass("own", undefined)).toBe("own");
    expect(mergeClass(undefined, "")).toBeUndefined();
    expect(mergeClass("", "x")).toBe("x");
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
