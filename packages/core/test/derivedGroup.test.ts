import { describe, expect, it } from "vitest";
import {
  attachFields,
  createControlGroup,
  createDerivedGroup,
  detachFields,
} from "../src/groupControl.js";
import { createControlContext } from "../src/controlContextImpl.js";
import { untrackedRead } from "../src/readContextImpl.js";

const makeCtx = () => createControlContext();

describe("createDerivedGroup", () => {
  it("survives overlapping membership, which an ordinary group does not", () => {
    // The shape a validity scope always ends up in: a control and one of its
    // own descendants in the same group.
    const ctx = makeCtx();
    const person = ctx.newControl({ name: "" });
    const plain = createControlGroup(ctx, {
      whole: person,
      part: person.fields.name,
    });
    ctx.update((wc) => wc.setValue(person.fields.name, "Ada"));
    // The ordinary group writes its stale copy of `part` back down.
    expect(person.fields.name.valueNow).toBe("");
    expect(plain.valueNow).toEqual({ whole: { name: "" }, part: "" });

    const ctx2 = makeCtx();
    const person2 = ctx2.newControl({ name: "" });
    const derived = createDerivedGroup(ctx2);
    ctx2.update((wc) =>
      attachFields(wc, derived, {
        whole: person2,
        part: person2.fields.name,
      }),
    );
    ctx2.update((wc) => wc.setValue(person2.fields.name, "Ada"));
    expect(person2.fields.name.valueNow).toBe("Ada");
    // And the composed value stays consistent across both routes.
    expect(untrackedRead.getValue(derived)).toEqual({
      whole: { name: "Ada" },
      part: "Ada",
    });
  });

  it("never writes its own value down to the children", () => {
    const ctx = makeCtx();
    const a = ctx.newControl("a");
    const group = createDerivedGroup(ctx);
    ctx.update((wc) => attachFields(wc, group, { a }));
    ctx.update((wc) => wc.setValue(group, { a: "clobbered" }));
    expect(a.valueNow).toBe("a");
  });

  it("aggregates validity and cascades touched", () => {
    const ctx = makeCtx();
    const a = ctx.newControl("");
    const b = ctx.newControl("");
    const group = createDerivedGroup(ctx);
    ctx.update((wc) => attachFields(wc, group, { a, b }));

    expect(group.validNow).toBe(true);
    ctx.update((wc) => wc.setError(b, "required", "Required"));
    expect(group.validNow).toBe(false);

    expect(a.touchedNow).toBe(false);
    ctx.update((wc) => wc.setTouched(group, true));
    expect(a.touchedNow).toBe(true);
    expect(b.touchedNow).toBe(true);
  });

  it("detaches a member, which stops it aggregating", () => {
    const ctx = makeCtx();
    const a = ctx.newControl("");
    const group = createDerivedGroup(ctx);
    ctx.update((wc) => attachFields(wc, group, { a }));
    ctx.update((wc) => wc.setError(a, "required", "Required"));
    expect(group.validNow).toBe(false);

    ctx.update((wc) => detachFields(wc, group, ["a"]));
    expect(group.validNow).toBe(true);
    expect(untrackedRead.getValue(group)).toEqual({});
    // and the detached control is untouched by later group writes
    ctx.update((wc) => wc.setValue(group, { a: "x" }));
    expect(a.valueNow).toBe("");
  });
});
