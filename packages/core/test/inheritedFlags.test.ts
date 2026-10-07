import { describe, expect, it } from "vitest";
import { createControlContext } from "../src/controlContextImpl.js";
import type { Control } from "../src/types.js";

/**
 * A lazily-created child starts with the flags it would have had if it had
 * existed when the parent's flag was set: inherited after a recursive
 * `setTouched` / `setDisabled`, not after a `notChildren` one. Lazy creation
 * must be invisible.
 */

type Flag = "touched" | "disabled";

const set = (
  ctx: ReturnType<typeof createControlContext>,
  flag: Flag,
  c: Control<any>,
  on: boolean,
  notChildren?: boolean,
) =>
  ctx.update((wc) =>
    flag === "touched"
      ? wc.setTouched(c, on, notChildren)
      : wc.setDisabled(c, on, notChildren),
  );

const get = (flag: Flag, c: Control<any>) =>
  flag === "touched" ? c.touchedNow : c.disabledNow;

describe.each<Flag>(["touched", "disabled"])("inherited %s", (flag) => {
  const compound = () => {
    const ctx = createControlContext();
    const c = ctx.newControl({ a: "", nested: { b: "" } });
    return { ctx, c };
  };

  it("a notChildren set leaves a field created later unset", () => {
    const { ctx, c } = compound();
    set(ctx, flag, c, true, true);
    expect(get(flag, c)).toBe(true);
    expect(get(flag, c.fields.a)).toBe(false);
    expect(get(flag, c.fields.nested)).toBe(false);
    expect(get(flag, c.fields.nested.fields.b)).toBe(false);
  });

  it("a recursive set reaches fields and grandchildren created later", () => {
    const { ctx, c } = compound();
    set(ctx, flag, c, true);
    expect(get(flag, c.fields.a)).toBe(true);
    expect(get(flag, c.fields.nested.fields.b)).toBe(true);
  });

  it("a recursive cascade passes inheritance on to existing children", () => {
    const { ctx, c } = compound();
    const nested = c.fields.nested; // exists, its own field `b` does not
    set(ctx, flag, c, true);
    expect(get(flag, nested)).toBe(true);
    expect(get(flag, nested.fields.b)).toBe(true);
  });

  it("a notChildren set after a recursive one does not undo it", () => {
    const { ctx, c } = compound();
    set(ctx, flag, c, true);
    set(ctx, flag, c, true, true);
    expect(get(flag, c.fields.a)).toBe(true);
    expect(get(flag, c.fields.nested.fields.b)).toBe(true);
  });

  it("a notChildren clear leaves existing children set and later ones unset", () => {
    const { ctx, c } = compound();
    const nested = c.fields.nested;
    set(ctx, flag, c, true);
    set(ctx, flag, c, false, true);
    expect(get(flag, c)).toBe(false);
    expect(get(flag, nested)).toBe(true);
    // `nested` was set recursively, so its own later children still inherit.
    expect(get(flag, nested.fields.b)).toBe(true);
    // A field of `c` created after the clear starts unset.
    expect(get(flag, c.fields.a)).toBe(false);
  });

  it("a recursive clear clears inheritance everywhere", () => {
    const { ctx, c } = compound();
    const nested = c.fields.nested;
    set(ctx, flag, c, true);
    set(ctx, flag, c, false);
    expect(get(flag, nested)).toBe(false);
    expect(get(flag, nested.fields.b)).toBe(false);
    expect(get(flag, c.fields.a)).toBe(false);
  });

  describe.each([
    ["value", false],
    ["initial value", true],
  ] as const)("array grown through its %s", (_, initial) => {
    const grow = (
      ctx: ReturnType<typeof createControlContext>,
      arr: Control<string[]>,
    ) =>
      ctx.update((wc) =>
        initial ? wc.setInitialValue(arr, ["x", "y"]) : wc.setValue(arr, ["x", "y"]),
      );

    it.each([
      [true, false],
      [false, true],
    ])("notChildren=%s: a new element set is %s", (notChildren, expected) => {
      const ctx = createControlContext();
      const arr = ctx.newControl<string[]>(["x"]);
      const first = arr.elementsNow[0];
      set(ctx, flag, arr, true, notChildren);
      expect(get(flag, first)).toBe(expected);
      grow(ctx, arr);
      expect(arr.elementsNow).toHaveLength(2);
      expect(get(flag, arr.elementsNow[1])).toBe(expected);
    });

    it.each([
      [true, false],
      [false, true],
    ])(
      "notChildren=%s: elements first created after growing are set: %s",
      (notChildren, expected) => {
        const ctx = createControlContext();
        const arr = ctx.newControl<string[]>(["x"]);
        set(ctx, flag, arr, true, notChildren);
        grow(ctx, arr);
        // Growing only the initial value adds no element to a value of length 1.
        const elems = arr.elementsNow;
        expect(elems).toHaveLength(initial ? 1 : 2);
        expect(elems.map((e) => get(flag, e))).toEqual(elems.map(() => expected));
      },
    );
  });
});
