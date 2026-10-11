import { describe, expect, it } from "vitest";
import { act } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useFormEdit } from "@rx-controls/react";
import {
  Action,
  Form,
  FormProvider,
  Disclosure,
  TextField,
  useTextInput,
  useValidation,
  type TextFieldRenderProps,
} from "../src";
import { flush, setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

const dom = setupDom();

/** A text field drawn through the controller, so it publishes its element. */
function Text(p: TextFieldRenderProps) {
  const ctl = useTextInput(p.field);
  const edit = useFormEdit();
  return ctl.rendered(
    <input
      id={p.id}
      ref={ctl.elementRef}
      value={ctl.value}
      disabled={!!edit.disabled}
      onChange={() => {}}
    />,
  );
}
const renderers = { ...testRenderers, textfield: Text };
const element = (c: Control<unknown>) => c.meta.element;

describe("a refused submit", () => {
  it("publishes the element, falling back to a widget still mounted when the latest goes", () => {
    const c = dom.ctx.newControl("");
    const second = dom.ctx.newControl(true);
    function Two() {
      return (
        <>
          <TextField field={c} id="a" />
          {untrackedRead.getValue(second) && <TextField field={c} id="b" />}
        </>
      );
    }
    dom.mount(
      <FormProvider renderers={renderers}>
        <Two />
      </FormProvider>,
    );
    expect((element(c) as HTMLElement).id).toBe("b");
    act(() => dom.ctx.update((wc) => wc.setValue(second, false)));
    dom.mount(
      <FormProvider renderers={renderers}>
        <Two />
      </FormProvider>,
    );
    expect((element(c) as HTMLElement).id).toBe("a");
  });

  it("leaves focus alone on a refused submit with focusInvalid={false}", async () => {
    const c = dom.ctx.newControl("");
    dom.mount(
      <FormProvider renderers={renderers}>
        <Form onSubmit={() => {}} focusInvalid={false}>
          <TextField field={c} id="a" required />
          <Action actionId="save" text="Save" submit />
        </Form>
      </FormProvider>,
    );
    act(() => dom.container.querySelector<HTMLButtonElement>("[data-action]")!.click());
    await flush();
    expect(document.activeElement?.id).not.toBe("a");
    expect(untrackedRead.isTouched(c)).toBe(true);
  });

  it("does not touch a hidden field, so one revealed afterwards is not already in error", async () => {
    const shown = dom.ctx.newControl("");
    const other = dom.ctx.newControl(false);
    const description = dom.ctx.newControl("");
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <Form onSubmit={() => {}}>
          <TextField field={shown} id="shown" required />
          <TextField
            field={description}
            id="description"
            required
            hidden={(rc) => !rc.getValue(other)}
          />
          <Action actionId="save" text="Save" submit />
        </Form>
      </FormProvider>,
    );
    act(() => dom.container.querySelector<HTMLButtonElement>("[data-action]")!.click());
    await flush();
    expect([untrackedRead.isTouched(shown), untrackedRead.isTouched(description)]).toEqual([
      true,
      false,
    ]);
    act(() => dom.ctx.update((wc) => wc.setValue(other, true)));
    expect(dom.container.querySelector('[data-field="description"] [data-error]')).toBeNull();
  });

  describe("inside an action holding the form's lock", () => {
    /** An action that checks, as a server-gated wizard page's does. */
    function Continue() {
      const validation = useValidation();
      return (
        <Action
          actionId="continue"
          text="Continue"
          disableType="global"
          onClick={async () => void (await validation.check())}
        />
      );
    }
    /** Where focus lands, and whether the field was disabled when it did. */
    function watch(id: string) {
      const seen: boolean[] = [];
      const el = dom.container.querySelector<HTMLInputElement>(`#${id}`)!;
      el.addEventListener("focus", () => seen.push(el.disabled));
      return seen;
    }
    const click = () =>
      act(() => dom.container.querySelector<HTMLButtonElement>("[data-action]")!.click());

    it("focuses the field once the lock lifts, not while it is disabled", async () => {
      const c = dom.ctx.newControl("");
      dom.mount(
        <FormProvider renderers={renderers}>
          <Form>
            <TextField field={c} id="a" required />
            <Continue />
          </Form>
        </FormProvider>,
      );
      const seen = watch("a");
      click();
      await flush();
      expect([seen, document.activeElement?.id]).toEqual([[false], "a"]);
    });

    it("focuses one behind a closed disclosure, revealed while the lock is held", async () => {
      const c = dom.ctx.newControl("");
      dom.mount(
        <FormProvider renderers={renderers}>
          <Form>
            <Disclosure title="More">
              <TextField field={c} id="a" required />
            </Disclosure>
            <Continue />
          </Form>
        </FormProvider>,
      );
      const seen = watch("a");
      click();
      await flush();
      expect([seen, document.activeElement?.id]).toEqual([[false], "a"]);
    });
  });
});
