import { describe, expect, it } from "vitest";
import {
  ControlChange,
  collectChanges,
  newControl,
  notEmpty,
  setFields,
} from "../src/index";
import type { ChangeListenerFunc, Control } from "../src/index";

interface Person {
  name: string;
  age: number;
}

function collector(): {
  listener: ChangeListenerFunc<any>;
  reads: [Control<any>, ControlChange][];
} {
  const reads: [Control<any>, ControlChange][] = [];
  return { listener: (c, change) => reads.push([c, change]), reads };
}

describe("prototype patch — getters", () => {
  it("value/initialValue/dirty reflect engine state", () => {
    const c = newControl("a");
    expect(c.value).toBe("a");
    expect(c.initialValue).toBe("a");
    expect(c.dirty).toBe(false);
    c.value = "b";
    expect(c.value).toBe("b");
    expect(c.dirty).toBe(true);
    c.markAsClean();
    expect(c.dirty).toBe(false);
    expect(c.initialValue).toBe("b");
  });

  it("error/errors/valid round-trip through the default key", () => {
    const c = newControl("x");
    expect(c.valid).toBe(true);
    c.error = "broken";
    expect(c.error).toBe("broken");
    expect(c.errors).toEqual({ default: "broken" });
    expect(c.valid).toBe(false);
    c.error = null;
    expect(c.valid).toBe(true);
    c.setError("other", "oops");
    expect(c.errors).toEqual({ other: "oops" });
    c.clearErrors();
    expect(c.valid).toBe(true);
  });

  it("touched/disabled setters cascade to children like legacy", () => {
    const c = newControl<Person>({ name: "a", age: 1 });
    const name = c.fields.name;
    c.touched = true;
    expect(name.touched).toBe(true);
    c.setTouched(false, true);
    expect(c.touched).toBe(false);
    // notChildren left the child alone
    expect(name.touched).toBe(true);
    c.disabled = true;
    expect(name.disabled).toBe(true);
  });

  it("fields navigation returns the same child each time", () => {
    const c = newControl<Person>({ name: "a", age: 1 });
    expect(c.fields.name).toBe(c.fields.name);
    c.fields.age.value = 2;
    expect(c.value).toEqual({ name: "a", age: 2 });
  });

  it("elements materializes from the value; isNull tracks nullness", () => {
    const c = newControl<string[] | null>(["x", "y"]);
    expect(c.elements.length).toBe(2);
    expect(c.elements[0].value).toBe("x");
    expect(c.isNull).toBe(false);
    c.value = null;
    expect(c.isNull).toBe(true);
  });

  it("current is an untracked snapshot view", () => {
    const c = newControl("a");
    const { reads, listener } = collector();
    collectChanges(listener, () => {
      const snap = c.current;
      void snap.value;
      void snap.dirty;
      void snap.error;
    });
    expect(reads).toEqual([]);
    expect(c.current.value).toBe("a");
  });

  it("element aliases meta.element", () => {
    const c = newControl("a");
    expect(c.element).toBeNull();
    const fake = { tag: "input" };
    c.element = fake;
    expect(c.element).toBe(fake);
    expect(c.meta.element).toBe(fake);
  });

  it("setInitialValue(v) resets value + initial; the setter moves the baseline alone", () => {
    // Legacy defines the method as setValueAndInitial(v, v)...
    const c = newControl("a");
    c.value = "edited";
    c.setInitialValue("b");
    expect(c.value).toBe("b");
    expect(c.initialValue).toBe("b");
    expect(c.dirty).toBe(false);

    // ...while the property setter leaves the current value alone.
    const d = newControl("a");
    d.initialValue = "b";
    expect(d.value).toBe("a");
    expect(d.initialValue).toBe("b");
    expect(d.dirty).toBe(true);
  });

  it("newControl's third arg sets the initial value only", () => {
    const c = newControl("a", undefined, "b");
    expect(c.value).toBe("a");
    expect(c.initialValue).toBe("b");
    expect(c.dirty).toBe(true);
  });

  it("setValue takes an updater callback", () => {
    const c = newControl(10);
    c.setValue((v) => v + 5);
    expect(c.value).toBe(15);
  });

  it("validate() re-publishes setup validator errors and returns validity", () => {
    const c = newControl("", { validator: notEmpty("Required") });
    expect(c.error).toBe("Required");
    expect(c.validate()).toBe(false);
    c.value = "filled";
    expect(c.validate()).toBe(true);
  });

  it("isEqual uses tree equality and stays bound when detached", () => {
    const c = newControl({ a: 1 });
    const eq = c.isEqual;
    expect(eq({ x: [1] }, { x: [1] })).toBe(true);
    expect(eq({ x: [1] }, { x: [2] })).toBe(false);
  });

  it("lookupControl walks fields and elements", () => {
    const c = newControl<{ items: { name: string }[] }>({
      items: [{ name: "n0" }, { name: "n1" }],
    });
    const found = c.lookupControl(["items", 1, "name"]);
    expect(found?.value).toBe("n1");
  });

  it("as() is an identity cast that widens the value type", () => {
    const c = newControl<string>("a");
    const widened: Control<string | undefined> = c.as<string | undefined>();
    expect(widened).toBe(c);
    // writes through the widened view land on the same control
    widened.value = undefined;
    expect(c.current.value).toBe(undefined);
  });

  it("addCleanup/cleanup run once and clear", () => {
    const c = newControl("a");
    let runs = 0;
    c.addCleanup(() => runs++);
    c.cleanup();
    c.cleanup();
    expect(runs).toBe(1);
  });

  // Regression: `cleanup()` tears down a *subtree*. Callers clean up a branch
  // by calling it on that branch's root — `@astroapps/forms-core` detaches an
  // array element by calling `cleanup()` on the element's base control, while
  // the effects being released are registered on descendant controls. Without
  // the recursion every removed array row leaked its evaluators.
  it("cleanup recurses into fields and elements", () => {
    const c = newControl<{ a: { deep: string }; list: string[] }>({
      a: { deep: "x" },
      list: ["1", "2"],
    });
    const ran: string[] = [];
    // Materialize the children and register a cleanup on each level.
    c.fields.a.addCleanup(() => ran.push("a"));
    c.fields.a.fields.deep.addCleanup(() => ran.push("a.deep"));
    c.fields.list.addCleanup(() => ran.push("list"));
    c.fields.list.elements[0].addCleanup(() => ran.push("list[0]"));
    c.fields.list.elements[1].addCleanup(() => ran.push("list[1]"));

    // The root itself has no registered cleanups — it must still recurse.
    c.cleanup();
    expect(ran.sort()).toEqual(["a", "a.deep", "list", "list[0]", "list[1]"]);

    // Idempotent, as at a single level.
    ran.length = 0;
    c.cleanup();
    expect(ran).toEqual([]);
  });

  it("cleanup leaves controls shared with another parent alone", () => {
    const shared = newControl("s");
    const owner = newControl<{ own: string }>({ own: "o" });
    // `setFields` attaches `shared` as a second parent's child.
    const other = setFields(newControl({}), { shared });
    setFields(owner, { shared });

    let sharedRuns = 0;
    let ownRuns = 0;
    shared.addCleanup(() => sharedRuns++);
    owner.fields.own.addCleanup(() => ownRuns++);

    owner.cleanup();
    expect(ownRuns).toBe(1);
    // Two parents — tearing it down here would pull it out from under `other`.
    expect(sharedRuns).toBe(0);
    expect(other.fields.shared.value).toBe("s");
  });
});

describe("prototype patch — ambient collection", () => {
  it("each getter reports its change bit", () => {
    const c = newControl<string[] | null>(["x"]);
    const { reads, listener } = collector();
    collectChanges(listener, () => {
      void c.value;
      void c.initialValue;
      void c.valid;
      void c.dirty;
      void c.touched;
      void c.disabled;
      void c.error;
      void c.errors;
      void c.isNull;
      void c.elements;
    });
    const bits = reads.map(([, change]) => change);
    expect(bits).toEqual([
      ControlChange.Value,
      ControlChange.InitialValue,
      ControlChange.Valid,
      ControlChange.Dirty,
      ControlChange.Touched,
      ControlChange.Disabled,
      ControlChange.Error,
      ControlChange.Error,
      ControlChange.Structure,
      ControlChange.Structure,
    ]);
    expect(reads.every(([control]) => control === (c as Control<any>))).toBe(
      true,
    );
  });

  it("collectChanges nests with save/restore", () => {
    const c = newControl(1);
    const outer = collector();
    const inner = collector();
    collectChanges(outer.listener, () => {
      void c.value;
      collectChanges(inner.listener, () => {
        void c.dirty;
      });
      void c.touched;
    });
    expect(outer.reads.map(([, ch]) => ch)).toEqual([
      ControlChange.Value,
      ControlChange.Touched,
    ]);
    expect(inner.reads.map(([, ch]) => ch)).toEqual([ControlChange.Dirty]);
    // Window closed — reads outside collect nothing
    void c.value;
    expect(outer.reads.length).toBe(2);
  });
});
