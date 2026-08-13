import { describe, expect, it } from "vitest";
import { ControlChange } from "../src/types";
import { controlGroup, setFields } from "../src/groupControl";
import { makeCtx } from "./index";

describe("controlGroup", () => {
  it("composes value and initial value from the children", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const age = ctx.newControl(30);
    ctx.update((wc) => wc.setValue(age, 31));

    const group = controlGroup(ctx, { name, age });
    expect(group.valueNow).toEqual({ name: "alice", age: 31 });
    expect(group.initialValueNow).toEqual({ name: "alice", age: 30 });
    expect(group.dirtyNow).toBe(true);
  });

  it("navigates to the original controls as fields", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const group = controlGroup(ctx, { name });
    expect(group.fields.name).toBe(name);
  });

  it("child writes update the group value and notify", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const group = controlGroup(ctx, { name });

    let notified = 0;
    group.subscribe(() => notified++, ControlChange.Value);

    ctx.update((wc) => wc.setValue(name, "bob"));
    expect(group.valueNow).toEqual({ name: "bob" });
    expect(notified).toBe(1);
  });

  it("group writes flow down to the children", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const age = ctx.newControl(30);
    const group = controlGroup(ctx, { name, age });

    ctx.update((wc) => wc.setValue(group, { name: "bob", age: 40 }));
    expect(name.valueNow).toBe("bob");
    expect(age.valueNow).toBe(40);
  });

  it("keeps a child shared with another parent in sync", () => {
    const ctx = makeCtx();
    const arr = ctx.newControl<string[]>(["x"]);
    const elem = arr.elementsNow[0];

    const group = controlGroup(ctx, { value: elem });
    ctx.update((wc) => wc.setValue(group, { value: "y" }));

    expect(elem.valueNow).toBe("y");
    expect(arr.valueNow).toEqual(["y"]);
  });

  it("aggregates validity from the children", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const group = controlGroup(ctx, { name });
    expect(group.validNow).toBe(true);

    ctx.update((wc) => wc.setError(name, "default", "bad"));
    expect(group.validNow).toBe(false);

    ctx.update((wc) => wc.setError(name, "default", null));
    expect(group.validNow).toBe(true);
  });
});

describe("setFields", () => {
  it("merges new fields over existing ones and notifies", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const group = controlGroup(ctx, { name });

    let notified = 0;
    group.subscribe(() => notified++, ControlChange.Value);

    const age = ctx.newControl(30);
    ctx.update((wc) => setFields(wc, group, { age }));

    expect(group.valueNow).toEqual({ name: "alice", age: 30 });
    expect((group.fields as any).age).toBe(age);
    expect(notified).toBe(1);
  });

  it("replaces a field, detaching the old child", () => {
    const ctx = makeCtx();
    const first = ctx.newControl("a");
    const second = ctx.newControl("b");
    const group = controlGroup(ctx, { name: first });

    ctx.update((wc) => setFields(wc, group, { name: second }));
    expect(group.valueNow).toEqual({ name: "b" });
    expect(group.fields.name).toBe(second);

    // The detached child no longer writes through to the group.
    ctx.update((wc) => wc.setValue(first, "z"));
    expect(group.valueNow).toEqual({ name: "b" });
  });

  it("is a no-op when the fields are unchanged", () => {
    const ctx = makeCtx();
    const name = ctx.newControl("alice");
    const group = controlGroup(ctx, { name });

    let notified = 0;
    group.subscribe(() => notified++, ControlChange.Value);
    ctx.update((wc) => setFields(wc, group, { name }));
    expect(notified).toBe(0);
  });
});
