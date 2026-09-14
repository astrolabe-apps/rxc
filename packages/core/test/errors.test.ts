import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { ControlChange } from "../src/types";
import { makeCtx } from "./index";

function notEmpty(msg: string) {
  return (v: string) => (!v ? msg : undefined);
}

describe("errors", () => {
  it("setting error makes control invalid", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (val) => {
        const ctx = makeCtx();
        const control = ctx.newControl(val);
        const changes: ControlChange[] = [];
        control.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        ctx.update((wc) => wc.setError(control, "default", "Error"));
        expect(control.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.setError(control, "default", ""));
        expect(control.validNow).toStrictEqual(true);
        expect(changes).toStrictEqual([
          ControlChange.Valid,
          ControlChange.Valid,
        ]);
        return control.validNow;
      }),
    );
  });

  it("setting child error makes control invalid", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const ctx = makeCtx();
        const parent = ctx.newControl({ v });
        const child = parent.fields.v;
        const changes: ControlChange[] = [];
        parent.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        ctx.update((wc) => wc.setError(child, "default", "Failed"));
        expect(parent.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.setError(child, "default", ""));
        expect(parent.validNow).toStrictEqual(true);
        expect(changes).toStrictEqual([
          ControlChange.Valid,
          ControlChange.Valid,
        ]);
        return parent.validNow;
      }),
    );
  });

  it("error state is cleared by clearing errors", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const ctx = makeCtx();
        const parent = ctx.newControl({ v });
        const child = parent.fields.v;
        const changes: ControlChange[] = [];
        child.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        ctx.update((wc) => wc.setError(child, "default", "error"));
        expect(child.validNow).toStrictEqual(false);
        expect(parent.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.setError(child, "default", ""));
        expect(child.validNow).toStrictEqual(true);
        expect(parent.validNow).toStrictEqual(true);
        expect(changes).toStrictEqual([
          ControlChange.Valid,
          ControlChange.Valid,
        ]);
        return parent.validNow;
      }),
    );
  });

  it("removing invalid child resets parent", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
        (strings) => {
          const ctx = makeCtx();
          const parent = ctx.newControl([strings, strings], {
            elements: { elements: { validator: notEmpty("Not blank") } },
          });
          const changes: ControlChange[] = [];
          parent.subscribe((a, c) => changes.push(c), ControlChange.Valid);
          expect(parent.validNow).toStrictEqual(true);
          const brokenParent = parent.elementsNow[0];
          const brokenChild = brokenParent.elementsNow[0];
          ctx.update((wc) => wc.setValue(brokenChild, ""));
          expect(brokenChild.validNow).toStrictEqual(false);
          expect(parent.validNow).toStrictEqual(false);
          ctx.update((wc) => wc.removeElement(brokenParent, brokenChild));
          expect(parent.validNow).toStrictEqual(true);
          ctx.update((wc) => wc.updateElements(parent, () => []));
          expect(parent.validNow).toStrictEqual(true);
          ctx.update((wc) => wc.setValue(parent, [["a"], [""]]));
          expect(parent.validNow).toStrictEqual(false);
          ctx.update((wc) => wc.removeElement(parent, 1));
          expect(parent.validNow).toStrictEqual(true);
          expect(changes).toStrictEqual([
            ControlChange.Valid,
            ControlChange.Valid,
            ControlChange.Valid,
            ControlChange.Valid,
          ]);
          return parent.validNow;
        },
      ),
    );
  });

  it("setup validation runs on value changes", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (msg) => {
        const ctx = makeCtx();
        const control = ctx.newControl<string>("", {
          validator: notEmpty("Not blank"),
        });
        const changes: ControlChange[] = [];
        control.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        expect(control.errorNow).toStrictEqual("Not blank");
        expect(control.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.setValue(control, "a"));
        expect(control.validNow).toStrictEqual(true);
        expect(control.errorNow).toBeNull();
        expect(changes).toStrictEqual([ControlChange.Valid]);
        return control.validNow;
      }),
    );
  });

  it("validate revalidates", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (msg) => {
        const ctx = makeCtx();
        const control = ctx.newControl<string>("", {
          validator: notEmpty("Not blank"),
        });
        const changes: ControlChange[] = [];
        control.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        expect(control.errorNow).toStrictEqual("Not blank");
        expect(control.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.clearErrors(control));
        expect(control.validNow).toStrictEqual(true);
        expect(control.errorNow).toBeNull();
        let isValid = true;
        ctx.update((wc) => {
          isValid = wc.validate(control);
        });
        expect(control.errorNow).toStrictEqual("Not blank");
        expect(control.validNow).toStrictEqual(false);
        expect(changes).toStrictEqual([
          ControlChange.Valid,
          ControlChange.Valid,
        ]);
        return !isValid;
      }),
    );
  });

  it("child errors are cleared by clearing parent", () => {
    fc.assert(
      fc.property(fc.string(), (v) => {
        const ctx = makeCtx();
        const parent = ctx.newControl({ v });
        const child = parent.fields.v;
        const changes: ControlChange[] = [];
        parent.subscribe((a, c) => changes.push(c), ControlChange.Valid);
        ctx.update((wc) => wc.setError(child, "default", "error"));
        expect(child.validNow).toStrictEqual(false);
        expect(parent.validNow).toStrictEqual(false);
        ctx.update((wc) => wc.clearErrors(parent));
        expect(child.validNow).toStrictEqual(true);
        expect(parent.validNow).toStrictEqual(true);
        expect(changes).toStrictEqual([
          ControlChange.Valid,
          ControlChange.Valid,
        ]);
        return parent.validNow;
      }),
    );
  });

  // Errors published from outside the control (mirrored from elsewhere, or
  // set by an async validator) must survive an unrelated value write.
  // Without `keepErrors` a FormStateNode's `base` control silently dropped
  // its mirrored validation error the moment its child list was appended to,
  // leaving the node reporting valid while the data control held an error.
  it("keepErrors preserves published errors across value writes", () => {
    const ctx = makeCtx();
    const kept = ctx.newControl({ a: 1, list: [] as number[] }, { keepErrors: true });
    const cleared = ctx.newControl({ a: 1, list: [] as number[] });

    for (const c of [kept, cleared]) {
      ctx.update((wc) => wc.setError(c, "mirrored", "boom"));
      expect(c.validNow).toStrictEqual(false);
    }

    // A write to the control's own value, and to a field of it.
    ctx.update((wc) => wc.setValue(kept, { a: 2, list: [] }));
    ctx.update((wc) => wc.setValue(cleared, { a: 2, list: [] }));
    expect(kept.errorsNow).toStrictEqual({ mirrored: "boom" });
    expect(cleared.errorsNow).toStrictEqual({});

    ctx.update((wc) => wc.setValue(kept.fields.list, [1, 2, 3]));
    expect(kept.errorsNow).toStrictEqual({ mirrored: "boom" });
    expect(kept.validNow).toStrictEqual(false);

    // Still explicitly clearable — keepErrors suppresses the implicit clear
    // on write, not `setError`/`clearErrors`.
    ctx.update((wc) => wc.setError(kept, "mirrored", null));
    expect(kept.errorsNow).toStrictEqual({});
    expect(kept.validNow).toStrictEqual(true);
  });

  it("a validator implies keepErrors", () => {
    const ctx = makeCtx();
    const c = ctx.newControl("", { validator: notEmpty("required") });
    expect(c.errorNow).toStrictEqual("required");
    // An unrelated published error survives the validator's own re-run.
    ctx.update((wc) => wc.setError(c, "other", "extra"));
    ctx.update((wc) => wc.setValue(c, "filled"));
    expect(c.errorsNow).toStrictEqual({ other: "extra" });
  });
});
