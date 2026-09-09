/**
 * Phase B components — F-components and render helpers with legacy
 * signatures, mounted under the one-time root ControlContextProvider.
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ControlContextProvider,
  Fcheckbox,
  getCompatContext,
  Finput,
  FormEditProvider,
  Fselect,
  NotDefinedContext,
  RenderArrayElements,
  RenderControl,
  RenderElements,
  RenderOptional,
  addElement,
  newControl,
  renderOptionally,
  useComponentTracking,
  useFormControlProps,
  useFormEdit,
} from "../src/index";
import type { Control } from "../src/index";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(ui: React.ReactNode) {
  // The one-time legacy migration step: the compat context provided once at
  // the root. Everything below is unchanged legacy-style code.
  act(() =>
    root.render(
      <ControlContextProvider value={getCompatContext()}>
        {ui}
      </ControlContextProvider>,
    ),
  );
}

const input = () => container.querySelector("input")!;

function setNativeValue(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el),
    "value",
  )!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("F-components", () => {
  it("Finput renders, self-subscribes, writes back", () => {
    const c = newControl("start");
    mount(<Finput control={c} />);
    expect(input().value).toBe("start");
    act(() => {
      c.value = "external";
    });
    expect(input().value).toBe("external");
    setNativeValue(input(), "typed");
    expect(c.value).toBe("typed");
  });

  it("Fselect and Fcheckbox bind through the compat context", () => {
    const s = newControl<string | undefined>("b");
    const b = newControl(false);
    mount(
      <>
        <Fselect control={s}>
          <option value="a">A</option>
          <option value="b">B</option>
        </Fselect>
        <Fcheckbox control={b} />
      </>,
    );
    expect(container.querySelector("select")!.value).toBe("b");
    expect(input().checked).toBe(false);
    act(() => input().click());
    expect(b.value).toBe(true);
  });

  it("useFormEdit reports the legacy `readonly` key", () => {
    // @rxc/controls spells this `readOnly`; compat maps it back, because a
    // legacy consumer reads `edit.readonly`. Nothing else asserts the key
    // name -- the fold test below goes straight to the DOM prop, which is
    // spelled readOnly on both sides and so would not notice.
    let seen: { readonly?: boolean; disabled?: boolean } | undefined;
    function Peek() {
      seen = useFormEdit();
      return null;
    }
    mount(
      <FormEditProvider readonly>
        <Peek />
      </FormEditProvider>,
    );
    expect(seen).toStrictEqual({ readonly: true, disabled: undefined });
  });

  it("useFormControlProps folds the ambient FormEditState", () => {
    const c = newControl("v");
    function Manual() {
      const stop = useComponentTracking();
      try {
        const { errorText, ...props } = useFormControlProps<
          string,
          HTMLInputElement
        >(c);
        void errorText;
        return <input {...(props as object)} />;
      } finally {
        stop();
      }
    }
    mount(
      <FormEditProvider readonly>
        <Manual />
      </FormEditProvider>,
    );
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
    expect(input().value).toBe("v");
  });
});

describe("render helpers (legacy callback signatures)", () => {
  it("RenderControl isolates ambient reads from the parent", () => {
    const c = newControl(0);
    let outerRenders = 0;
    function Page() {
      outerRenders++;
      return <RenderControl>{() => <span id="out">{c.value}</span>}</RenderControl>;
    }
    mount(<Page />);
    expect(container.querySelector("#out")!.textContent).toBe("0");
    const before = outerRenders;
    act(() => {
      c.value = 5;
    });
    expect(container.querySelector("#out")!.textContent).toBe("5");
    expect(outerRenders).toBe(before);
  });

  it("RenderControl accepts the render prop alias", () => {
    const c = newControl("x");
    mount(<RenderControl render={() => <i id="out">{c.value}</i>} />);
    expect(container.querySelector("#out")!.textContent).toBe("x");
  });

  it("RenderOptional narrows and falls back to NotDefinedContext", () => {
    const c = newControl<string | undefined>(undefined);
    const Ndc = NotDefinedContext();
    mount(
      <Ndc.Provider value={<i id="nd">loading</i>}>
        <RenderOptional control={c}>
          {(defined) => <span id="out">{defined.value}</span>}
        </RenderOptional>
      </Ndc.Provider>,
    );
    expect(container.querySelector("#nd")!.textContent).toBe("loading");
    act(() => {
      c.value = "here";
    });
    expect(container.querySelector("#out")!.textContent).toBe("here");
  });

  it("RenderElements maps element controls with legacy children", () => {
    const c = newControl<string[]>(["a", "b"]);
    mount(
      <RenderElements
        control={c}
        empty={<i id="empty">none</i>}
        container={(kids) => <div id="list">{kids}</div>}
      >
        {(elem: Control<string>, i: number, total: number) => (
          <span className="row">
            {i}/{total}:{elem.value}
          </span>
        )}
      </RenderElements>,
    );
    const rows = () =>
      [...container.querySelectorAll(".row")].map((r) => r.textContent);
    expect(rows()).toEqual(["0/2:a", "1/2:b"]);
    act(() => {
      addElement(c, "c");
    });
    expect(rows()).toEqual(["0/3:a", "1/3:b", "2/3:c"]);
    act(() => {
      c.value = [];
    });
    expect(container.querySelector("#empty")!.textContent).toBe("none");
  });

  it("renderOptionally composes with RenderControl and waits for all", () => {
    const user = newControl<string | undefined>(undefined);
    const account = newControl<number | undefined>(undefined);
    mount(
      <RenderControl>
        {renderOptionally(
          { user, account },
          ({ user, account }) => (
            <span id="out">
              {user}#{account}
            </span>
          ),
          <i id="wait">waiting</i>,
        )}
      </RenderControl>,
    );
    expect(container.querySelector("#wait")).not.toBeNull();
    act(() => {
      user.value = "ada";
    });
    expect(container.querySelector("#wait")).not.toBeNull();
    act(() => {
      account.value = 42;
    });
    expect(container.querySelector("#out")!.textContent).toBe("ada#42");
  });

  it("RenderArrayElements renders plain arrays", () => {
    mount(
      <RenderArrayElements array={["x", "y"]}>
        {(v, i) => (
          <span className="row">
            {i}:{v}
          </span>
        )}
      </RenderArrayElements>,
    );
    expect(
      [...container.querySelectorAll(".row")].map((r) => r.textContent),
    ).toEqual(["0:x", "1:y"]);
  });
});
