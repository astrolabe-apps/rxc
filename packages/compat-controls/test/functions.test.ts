import { describe, expect, it } from "vitest";
import {
  addElement,
  cloneFields,
  controlGroup,
  controlNotNull,
  delayedValue,
  ensureMetaValue,
  clearMetaValue,
  getControlPath,
  getCurrentFields,
  getElementIndex,
  getMetaValue,
  newControl,
  newElement,
  removeElement,
  setFields,
  updateComputedValue,
  updateElements,
  withChildren,
} from "../src/index";

describe("array functions", () => {
  it("addElement appends / inserts and returns the element control", () => {
    const c = newControl<string[]>(["a"]);
    const b = addElement(c, "b");
    expect(b.value).toBe("b");
    expect(c.value).toEqual(["a", "b"]);
    addElement(c, "front", 0);
    expect(c.value).toEqual(["front", "a", "b"]);
  });

  it("removeElement by index and by control", () => {
    const c = newControl<string[]>(["a", "b", "c"]);
    removeElement(c, 1);
    expect(c.value).toEqual(["a", "c"]);
    removeElement(c, c.elements[0]);
    expect(c.value).toEqual(["c"]);
  });

  it("updateElements reorders; newElement builds attachable controls", () => {
    const c = newControl<string[]>(["a", "b"]);
    updateElements(c, (elems) => [...elems].reverse());
    expect(c.value).toEqual(["b", "a"]);
    const fresh = newElement(c, "z");
    updateElements(c, (elems) => [fresh, ...elems]);
    expect(c.value).toEqual(["z", "b", "a"]);
  });

  it("getElementIndex reports current and initial position", () => {
    const c = newControl<string[]>(["a", "b"]);
    const first = c.elements[0];
    updateElements(c, (elems) => [...elems].reverse());
    const idx = getElementIndex(first, c);
    expect(idx?.index).toBe(1);
    expect(idx?.initialIndex).toBe(0);
  });
});

describe("object / group functions", () => {
  it("controlGroup aggregates attached children", () => {
    const name = newControl("n");
    const age = newControl(3);
    const group = controlGroup({ name, age });
    expect(group.value).toEqual({ name: "n", age: 3 });
    name.value = "changed";
    expect(group.value).toEqual({ name: "changed", age: 3 });
    group.fields.age.value = 4;
    expect(age.value).toBe(4);
  });

  it("getCurrentFields returns only materialized fields", () => {
    const c = newControl<{ a: string; b: string }>({ a: "1", b: "2" });
    expect(Object.keys(getCurrentFields(c))).toEqual([]);
    void c.fields.a;
    expect(Object.keys(getCurrentFields(c))).toEqual(["a"]);
  });

  it("cloneFields shares the original's field controls", () => {
    const c = newControl<{ a: string }>({ a: "1" });
    const fieldA = c.fields.a;
    const clone = cloneFields(c);
    expect(clone.value).toEqual({ a: "1" });
    fieldA.value = "changed";
    expect(clone.value).toEqual({ a: "changed" });
  });

  it("setFields attaches foreign controls onto a group", () => {
    const base = newControl<{ a: string }>({ a: "1" });
    const extra = newControl("x");
    const widened = setFields(base, { b: extra });
    expect(widened.value).toEqual({ a: "1", b: "x" });
    extra.value = "y";
    expect(widened.value).toEqual({ a: "1", b: "y" });
  });

  it("withChildren visits only existing children", () => {
    const c = newControl<{ a: string; b: string }>({ a: "1", b: "2" });
    void c.fields.a;
    const visited: unknown[] = [];
    withChildren(c, (child) => visited.push(child.value));
    expect(visited).toEqual(["1"]);
  });
});

describe("misc functions", () => {
  it("controlNotNull narrows", () => {
    const c = newControl<string | undefined>(undefined);
    expect(controlNotNull(c)).toBeUndefined();
    expect(controlNotNull(undefined)).toBeUndefined();
    c.value = "here";
    expect(controlNotNull(c)?.value).toBe("here");
  });

  it("getControlPath tracks position in the tree", () => {
    const c = newControl<{ items: string[] }>({ items: ["a", "b"] });
    const elem = c.fields.items.elements[1];
    expect(getControlPath(elem)).toEqual(["items", 1]);
  });

  it("delayedValue computes lazily on each read", () => {
    let n = 0;
    const v = delayedValue(() => ++n);
    expect(n).toBe(0);
    expect(v.value).toBe(1);
    expect(v.value).toBe(2);
  });

  it("meta helpers", () => {
    const c = newControl(1);
    expect(getMetaValue(c, "k")).toBeUndefined();
    expect(ensureMetaValue(c, "k", () => "v")).toBe("v");
    expect(ensureMetaValue(c, "k", () => "other")).toBe("v");
    clearMetaValue(c, "k");
    expect(getMetaValue(c, "k")).toBeUndefined();
  });

  it("updateComputedValue keeps the target recomputed", () => {
    const a = newControl(1);
    const b = newControl(2);
    const target = newControl(0);
    const compute = () => a.value + b.value;
    updateComputedValue(target, compute);
    expect(target.value).toBe(3);
    a.value = 10;
    expect(target.value).toBe(12);
    // idempotent for the same function
    updateComputedValue(target, compute);
    b.value = 5;
    expect(target.value).toBe(15);
    // cleanup tears the computation down
    target.cleanup();
    a.value = 100;
    expect(target.value).toBe(15);
  });
});
