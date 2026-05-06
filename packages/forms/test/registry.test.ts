import { describe, expect, it } from "vitest";
import {
  combineRegistries,
  emptyRegistry,
  pickDataRenderer,
  type DataMatcher,
} from "../src/registry";

const noopRc = {} as never;
const noopNode = {} as never;

function fakeMatcher(name: string, hits: boolean): DataMatcher {
  const Component = () => null;
  Component.displayName = name;
  return () => (hits ? { component: Component } : null);
}

describe("combineRegistries", () => {
  it("concatenates matcher arrays in argument order", () => {
    const a = { data: [fakeMatcher("a1", true)] };
    const b = { data: [fakeMatcher("b1", true)] };
    const merged = combineRegistries(a, b);
    expect(merged.data).toHaveLength(2);
    const first = pickDataRenderer(merged.data, noopNode, noopRc);
    expect((first?.component as { displayName: string }).displayName).toBe(
      "a1",
    );
  });

  it("custom matcher prepended via combineRegistries wins over default", () => {
    const customRenderer = () => null;
    customRenderer.displayName = "Custom";
    const defaultRenderer = () => null;
    defaultRenderer.displayName = "Default";

    const custom = { data: [(): { component: typeof customRenderer } => ({ component: customRenderer })] };
    const def = { data: [(): { component: typeof defaultRenderer } => ({ component: defaultRenderer })] };

    const reg = combineRegistries(custom, def);
    const hit = pickDataRenderer(reg.data, noopNode, noopRc);
    expect((hit?.component as { displayName: string }).displayName).toBe(
      "Custom",
    );
  });

  it("falls through to next matcher when first returns null", () => {
    const reg = combineRegistries({
      data: [fakeMatcher("first", false), fakeMatcher("second", true)],
    });
    const hit = pickDataRenderer(reg.data, noopNode, noopRc);
    expect((hit?.component as { displayName: string }).displayName).toBe(
      "second",
    );
  });

  it("returns null when no matcher hits", () => {
    const reg = combineRegistries({ data: [fakeMatcher("nope", false)] });
    expect(pickDataRenderer(reg.data, noopNode, noopRc)).toBeNull();
  });

  it("merges schemaExtensions with earlier entries shadowing later", () => {
    const merged = combineRegistries(
      { schemaExtensions: { Foo: { v: "first" } } },
      { schemaExtensions: { Foo: { v: "second" }, Bar: { v: "bar" } } },
    );
    expect(merged.schemaExtensions.Foo).toEqual({ v: "first" });
    expect(merged.schemaExtensions.Bar).toEqual({ v: "bar" });
  });

  it("merges childResolvers with earlier entries shadowing later", () => {
    const r1 = () => [];
    const r2 = () => [];
    const merged = combineRegistries(
      { childResolvers: { MyType: r1 } },
      { childResolvers: { MyType: r2, OtherType: r2 } },
    );
    expect(merged.childResolvers.MyType).toBe(r1);
    expect(merged.childResolvers.OtherType).toBe(r2);
  });

  it("emptyRegistry has empty arrays and maps", () => {
    const e = emptyRegistry();
    expect(e.data).toEqual([]);
    expect(e.group).toEqual([]);
    expect(e.action).toEqual([]);
    expect(e.display).toEqual([]);
    expect(e.schemaExtensions).toEqual({});
    expect(e.childResolvers).toEqual({});
  });
});
