import { describe, expect, it } from "vitest";
import { ControlChange } from "../src/types";
import { makeCtx } from "./index";

describe("setElementIncluded", () => {
  it("toggling an element off and back on leaves the control clean", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a", "b", "c"]);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    expect(tags.valueNow).toEqual(["b", "c"]);
    expect(tags.dirtyNow).toBe(true);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    // Members match the baseline, so the baseline itself is written back —
    // not ["b", "c", "a"].
    expect(tags.valueNow).toEqual(["a", "b", "c"]);
    expect(tags.dirtyNow).toBe(false);
  });

  it("reports clean at ancestors, not just the array control", () => {
    const ctx = makeCtx();
    const form = ctx.newControl<{ name: string; tags: string[] }>({
      name: "x",
      tags: ["a", "b"],
    });
    const tags = form.fields.tags;

    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    expect(form.dirtyNow).toBe(true);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    expect(tags.dirtyNow).toBe(false);
    expect(form.dirtyNow).toBe(false);
    expect(form.valueNow).toEqual({ name: "x", tags: ["a", "b"] });
  });

  it("a genuinely different set stays dirty", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a", "b"]);

    ctx.update((wc) => wc.setElementIncluded(tags, "c", true));
    expect(tags.valueNow).toEqual(["a", "b", "c"]);
    expect(tags.dirtyNow).toBe(true);
  });

  it("only the baseline is canonicalised, not arbitrary reorderings", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a", "b", "c"]);

    // Away from the baseline, order follows toggle history and is left alone.
    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    ctx.update((wc) => wc.setElementIncluded(tags, "b", false));
    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    expect(tags.valueNow).toEqual(["c", "a"]);
    expect(tags.dirtyNow).toBe(true);

    // Returning to the baseline set restores the baseline ordering.
    ctx.update((wc) => wc.setElementIncluded(tags, "b", true));
    expect(tags.valueNow).toEqual(["a", "b", "c"]);
    expect(tags.dirtyNow).toBe(false);
  });

  it("no-ops when the element is already in the requested state", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a"]);
    const changes: ControlChange[] = [];
    tags.subscribe((_c, ch) => changes.push(ch), ControlChange.Value);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    ctx.update((wc) => wc.setElementIncluded(tags, "b", false));

    expect(changes).toEqual([]);
    expect(tags.valueNow).toEqual(["a"]);
  });

  it("round-trips a null baseline through the empty set", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[] | null>(null);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    expect(tags.valueNow).toEqual(["a"]);
    expect(tags.dirtyNow).toBe(true);

    // Empty result against a null baseline writes null back rather than
    // materialising [].
    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    expect(tags.valueNow).toBe(null);
    expect(tags.dirtyNow).toBe(false);
  });

  it("round-trips an undefined baseline", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[] | undefined>(undefined);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    expect(tags.valueNow).toBe(undefined);
    expect(tags.dirtyNow).toBe(false);
  });

  it("excluding from a null value is a no-op", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[] | null>(null);
    const changes: ControlChange[] = [];
    tags.subscribe((_c, ch) => changes.push(ch), ControlChange.Value);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));

    expect(changes).toEqual([]);
    expect(tags.valueNow).toBe(null);
  });

  it("keeps an empty-array baseline as an array", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>([]);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));

    expect(tags.valueNow).toEqual([]);
    expect(tags.dirtyNow).toBe(false);
  });

  it("handles numeric members", () => {
    const ctx = makeCtx();
    const picked = ctx.newControl<number[]>([1, 2, 3]);

    ctx.update((wc) => wc.setElementIncluded(picked, 2, false));
    expect(picked.valueNow).toEqual([1, 3]);
    expect(picked.dirtyNow).toBe(true);

    ctx.update((wc) => wc.setElementIncluded(picked, 2, true));
    expect(picked.valueNow).toEqual([1, 2, 3]);
    expect(picked.dirtyNow).toBe(false);
  });


  it("tracks a baseline moved by markAsClean", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a", "b"]);

    ctx.update((wc) => wc.setElementIncluded(tags, "c", true));
    ctx.update((wc) => wc.markAsClean(tags));
    expect(tags.dirtyNow).toBe(false);

    ctx.update((wc) => wc.setElementIncluded(tags, "a", false));
    ctx.update((wc) => wc.setElementIncluded(tags, "a", true));
    expect(tags.valueNow).toEqual(["a", "b", "c"]);
    expect(tags.dirtyNow).toBe(false);
  });

  it("syncs existing element controls", () => {
    const ctx = makeCtx();
    const tags = ctx.newControl<string[]>(["a", "b"]);
    const elems = tags.elementsNow;
    expect(elems.map((e) => e.valueNow)).toEqual(["a", "b"]);

    ctx.update((wc) => wc.setElementIncluded(tags, "b", false));
    expect(tags.elementsNow.map((e) => e.valueNow)).toEqual(["a"]);

    ctx.update((wc) => wc.setElementIncluded(tags, "b", true));
    expect(tags.elementsNow.map((e) => e.valueNow)).toEqual(["a", "b"]);
    expect(tags.valueNow).toEqual(tags.elementsNow.map((e) => e.valueNow));
  });
});
