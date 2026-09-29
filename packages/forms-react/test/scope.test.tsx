import { describe, expect, it } from "vitest";
import { act } from "react";
import type { Control } from "@rx-controls/core";
import {
  FormEditProvider,
  useReactive,
  type Rendered,
} from "@rx-controls/react";
import {
  Form,
  FormScopeProvider,
  narrowScope,
  useBoundScope,
  useFieldState,
  useFormScope,
  type FormProp,
  type Presence,
} from "../src/index";
import { setupDom } from "./harness";

const dom = setupDom();

/** Prints the scope at its position: presence / disabled / readOnly. */
function Probe({ id }: { id: string }): Rendered {
  const { rc, rendered } = useReactive();
  const s = useFormScope();
  return rendered(
    <i data-probe={id}>
      {`${s.presence(rc)} ${s.disabled(rc)} ${s.readOnly(rc)} ${s.clearHidden}`}
    </i>,
  );
}
const read = (id: string) =>
  dom.container.querySelector(`[data-probe="${id}"]`)!.textContent;

/** A boundary-shaped region: useBoundScope over its own flags. */
function Region(props: {
  hidden?: FormProp<boolean | undefined>;
  disabled?: FormProp<boolean>;
  readOnly?: FormProp<boolean>;
  children: React.ReactNode;
}) {
  const scope = useBoundScope(props);
  return <FormScopeProvider scope={scope}>{props.children}</FormScopeProvider>;
}

/** A container that narrows its content to a given presence. */
function Presence({
  presence,
  children,
}: {
  presence: Presence;
  children: React.ReactNode;
}) {
  const parent = useFormScope();
  return (
    <FormScopeProvider scope={narrowScope(parent, { presence })}>
      {children}
    </FormScopeProvider>
  );
}

describe("presence", () => {
  it("is rendered at the root", () => {
    dom.mount(<Probe id="a" />);
    expect(read("a")).toBe("rendered false false false");
  });

  it("narrows and never widens: hidden beats silent beats rendered", () => {
    dom.mount(
      <Form>
        <Presence presence="silent">
          <Probe id="silent" />
          <Presence presence="rendered">
            <Probe id="stillSilent" />
          </Presence>
          <Presence presence="hidden">
            <Probe id="hidden" />
            <Presence presence="silent">
              <Probe id="stillHidden" />
            </Presence>
          </Presence>
        </Presence>
      </Form>,
    );
    expect(read("silent")).toMatch(/^silent/);
    expect(read("stillSilent")).toMatch(/^silent/);
    expect(read("hidden")).toMatch(/^hidden/);
    expect(read("stillHidden")).toMatch(/^hidden/);
  });

  it("follows a reactive hidden without re-rendering the region's provider", () => {
    const hide = dom.ctx.newControl(false);
    dom.mount(
      <Form>
        <Region hidden={hide}>
          <Probe id="p" />
        </Region>
      </Form>,
    );
    expect(read("p")).toMatch(/^rendered/);
    act(() => dom.ctx.update((wc) => wc.setValue(hide, true)));
    expect(read("p")).toMatch(/^hidden/);
  });

  it("treats a hidden that resolves to undefined — pending — as shown", () => {
    dom.mount(
      <Form>
        <Region hidden={() => undefined}>
          <Probe id="p" />
        </Region>
      </Form>,
    );
    expect(read("p")).toMatch(/^rendered/);
  });
});

describe("locks", () => {
  it("are restriction-only: a child cannot unlock what an ancestor locked", () => {
    dom.mount(
      <Form disabled readOnly>
        <Region disabled={false} readOnly={false}>
          <Probe id="p" />
        </Region>
      </Form>,
    );
    expect(read("p")).toBe("rendered true true false");
  });

  it("fold in @rx-controls/react's FormEditState", () => {
    dom.mount(
      <Form>
        <FormEditProvider disabled readOnly>
          <Region>
            <Probe id="p" />
          </Region>
        </FormEditProvider>
      </Form>,
    );
    expect(read("p")).toBe("rendered true true false");
  });

  it("carry clearHidden from the form down", () => {
    dom.mount(
      <Form clearHidden>
        <Region>
          <Probe id="p" />
        </Region>
      </Form>,
    );
    expect(read("p")).toBe("rendered false false true");
  });
});

describe("useFieldState", () => {
  function State({ c }: { c: Control<string> }): Rendered {
    const { rc, rendered } = useReactive();
    const s = useFieldState(rc, c);
    return rendered(<i data-probe="s">{JSON.stringify(s)}</i>);
  }

  it("folds the control's own disabled with the scope's locks", () => {
    const c = dom.ctx.newControl("x");
    dom.mount(
      <Form readOnly>
        <State c={c} />
      </Form>,
    );
    expect(JSON.parse(read("s")!)).toMatchObject({
      disabled: false,
      readOnly: true,
    });
    act(() => dom.ctx.update((wc) => wc.setDisabled(c, true)));
    expect(JSON.parse(read("s")!)).toMatchObject({ disabled: true });
  });

  it("lists every error on the control, de-duplicated", () => {
    const c = dom.ctx.newControl("x");
    act(() =>
      dom.ctx.update((wc) => {
        wc.setError(c, "a", "Bad");
        wc.setError(c, "b", "Bad");
        wc.setError(c, "c", "Worse");
      }),
    );
    dom.mount(<State c={c} />);
    expect(JSON.parse(read("s")!).errors).toEqual(["Bad", "Worse"]);
  });
});
