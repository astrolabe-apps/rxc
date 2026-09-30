import { beforeEach, describe, expect, it } from "vitest";
import { act, StrictMode, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useControlContext, useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  Contents,
  Dialog,
  Elements,
  Form,
  FormProvider,
  getExternalEdit,
  Tabs,
  TextField,
  useFormValidation,
  Wizard,
  type ValidationScope,
} from "../src/index";
import { flush, setupDom } from "./harness";
import { mounts, testRenderers } from "./testRenderers";

/**
 * Everything effect-driven, under StrictMode: React mounts, unmounts and
 * remounts every effect once, so anything that registers, publishes, counts
 * or reacts to a transition from an effect has to come out the same as one
 * mount. The validation tree's single attach is covered in
 * validation.test.tsx; this is the rest.
 */
const dom = setupDom();
beforeEach(() => mounts.clear());
const rc = untrackedRead;
const $ = <E extends Element = HTMLElement>(sel: string) =>
  dom.container.querySelector(sel) as E | null;
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));
const click = (sel: string) => act(() => $<HTMLButtonElement>(sel)!.click());

let root: ValidationScope;
function Owner({ children, clearHidden }: { children: ReactNode; clearHidden?: boolean }) {
  root = useFormValidation();
  return (
    <Form validation={root} clearHidden={clearHidden}>
      {children}
    </Form>
  );
}
function mount(ui: ReactNode, clearHidden = false) {
  dom.mount(
    <StrictMode>
      <FormProvider renderers={testRenderers}>
        <Owner clearHidden={clearHidden}>{ui}</Owner>
      </FormProvider>
    </StrictMode>,
  );
}

describe("under StrictMode", () => {
  it("a field publishes its required error once, and clears it once filled", () => {
    const c = dom.ctx.newControl("");
    mount(<TextField field={c} id="c" required />);
    const errs = Object.values(rc.getErrors(c));
    expect(errs).toEqual(["Please enter a value"]);
    expect(root.isValid(rc)).toBe(false);
    set(c, "x");
    expect(rc.getErrors(c)).toEqual({});
    expect(root.isValid(rc)).toBe(true);
  });

  it("the clearHidden / defaultValue cycle converges: cleared once hidden, defaulted once shown", () => {
    const show = dom.ctx.newControl(true);
    const c = dom.ctx.newControl<string | undefined>(undefined);
    mount(
      <Contents hidden={(rc) => !rc.getValue(show)}>
        <TextField field={c} id="c" defaultValue="dflt" />
      </Contents>,
      true,
    );
    expect(rc.getValue(c)).toBe("dflt");
    set(c, "typed");
    set(show, false);
    expect(rc.getValue(c)).toBeUndefined();
    set(show, true);
    expect(rc.getValue(c)).toBe("dflt");
  });

  it("mounting touches nothing; leaving a tab touches it", () => {
    const a = dom.ctx.newControl("");
    const b = dom.ctx.newControl("");
    mount(
      <Tabs
        items={[
          { key: "one", title: "1", children: <TextField field={a} required /> },
          { key: "two", title: "2", children: <TextField field={b} required /> },
        ]}
      />,
    );
    expect(rc.isTouched(a)).toBe(false);
    expect(rc.isTouched(b)).toBe(false);
    click('[data-tab="two"]');
    expect(rc.isTouched(a)).toBe(true);
    expect(rc.isTouched(b)).toBe(false);
  });

  it("an opening and closing dialog touches only on the close", () => {
    const open = dom.ctx.newControl(false);
    const c = dom.ctx.newControl("");
    mount(
      <Dialog open={open}>
        <TextField field={c} required />
      </Dialog>,
    );
    set(open, true);
    expect(rc.isTouched(c)).toBe(false);
    set(open, false);
    expect(rc.isTouched(c)).toBe(true);
  });

  it("an async validator's pending count returns to zero, so Next settles and advances", async () => {
    const name = dom.ctx.newControl("Ada");
    mount(
      <Wizard
        items={[
          {
            key: "who",
            title: "Who",
            children: (
              <TextField
                field={name}
                validate={{
                  slow: async (v) => {
                    await new Promise((r) => setTimeout(r, 10));
                    return v === "Smith" ? "Taken" : null;
                  },
                }}
              />
            ),
          },
          { key: "next", title: "Next", children: <p /> },
        ]}
      />,
    );
    await flush(30);
    expect(root.pending(rc)).toBe(false);
    click("[data-next]");
    await flush(30);
    expect($("[data-wizard]")!.getAttribute("data-index")).toBe("1");
    expect(root.pending(rc)).toBe(false);
  });

  it("a global action releases the form's lock when it settles", async () => {
    const c = dom.ctx.newControl("x");
    let finish!: () => void;
    mount(
      <>
        <TextField field={c} id="c" />
        <Action
          actionId="save"
          disableType="global"
          onClick={() => new Promise<void>((r) => (finish = r))}
        />
      </>,
    );
    click('[data-action="save"]');
    expect($<HTMLInputElement>("#c")!.disabled).toBe(true);
    await act(async () => finish());
    await flush();
    expect($<HTMLInputElement>("#c")!.disabled).toBe(false);
  });

  it("collection writes and a staged edit apply exactly once", () => {
    const pets = dom.ctx.newControl([{ name: "Rex" }]);
    function Host(): Rendered {
      const { rc, rendered } = useReactive();
      const edit = getExternalEdit(useControlContext(), pets);
      const session = edit.session(rc);
      return rendered(
        <>
          {session && <TextField field={session.draft.fields.name} id="draft" />}
          <button data-apply onClick={() => edit.apply()} />
        </>,
      );
    }
    mount(
      <>
        <Elements field={pets}>
          {(p, i, row) => (
            <>
              <TextField field={p.fields.name} id={`row${i}`} />
              <button data-edit={i} onClick={() => row.edit(i)} />
              <button data-add onClick={() => row.add({ name: "New" })} />
            </>
          )}
        </Elements>
        <Host />
      </>,
    );
    click("[data-add]");
    expect(rc.getValue(pets)).toEqual([{ name: "Rex" }, { name: "New" }]);
    click('[data-edit="0"]');
    const draft = $<HTMLInputElement>("#draft")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(draft, "Max");
      draft.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rc.getValue(pets)[0].name).toBe("Rex");
    click("[data-apply]");
    expect(rc.getValue(pets)).toEqual([{ name: "Max" }, { name: "New" }]);
    expect($("#draft")).toBeNull();
  });
});
