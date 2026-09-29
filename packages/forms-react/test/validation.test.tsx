import { describe, expect, it } from "vitest";
import { act, StrictMode, useEffect, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useControl } from "@rx-controls/react";
import {
  Form,
  FormScopeProvider,
  narrowScope,
  useFormScope,
  useFormValidation,
  useValidation,
  type Presence,
  type ValidationScope,
  type Validator,
} from "../src/index";
import {
  requiredKey,
  useDefaultValue,
  useFieldValidation,
  useMirror,
} from "../src/fieldValidation";
import {
  useChildValidationScope,
  useValidationScope,
  ValidationScopeProvider,
} from "../src/validationScope";
import { flush, setupDom } from "./harness";

const dom = setupDom();

/**
 * A field boundary's validation half, and nothing else: the verdict, the
 * validators, registration with the nearest scope. `active` stands for
 * presence (shown and not pending).
 */
function Rule<T>(props: {
  control: Control<T>;
  owner: string;
  required?: boolean;
  validate?: Validator<T> | Record<string, Validator<T>>;
  active?: boolean;
  verdictOut?: (v: Control<unknown>) => void;
}) {
  const { control, owner } = props;
  const cfg = useMirror({
    active: props.active ?? true,
    required: !!props.required,
    requiredMessage: "Required",
  });
  const verdict = useControl<unknown>(undefined);
  props.verdictOut?.(verdict);
  const scope = useValidationScope();
  useFieldValidation(control, props.validate, cfg, scope, owner, verdict);
  useEffect(() => scope?.register(verdict, control), [scope, verdict, control]);
  return null;
}

/** A named validation scope — a page, a section. */
function Scope({
  name,
  kind = "page",
  children,
}: {
  name: string;
  kind?: "page" | "section" | "tab";
  children: ReactNode;
}) {
  const s = useChildValidationScope(useValidationScope(), kind, name);
  return <ValidationScopeProvider value={s}>{children}</ValidationScopeProvider>;
}

/** The owner of a form: renders <Form> and hands the test its root. */
function Owner({
  out,
  children,
}: {
  out: (v: ValidationScope) => void;
  children: ReactNode;
}) {
  const v = useFormValidation();
  out(v);
  return <Form validation={v}>{children}</Form>;
}

const errorsOf = (c: Control<unknown>) => untrackedRead.getErrors(c);

describe("a field's validators", () => {
  it("publish onto the data and onto the boundary's verdict", () => {
    const c = dom.ctx.newControl("");
    let verdict!: Control<unknown>;
    dom.mount(
      <Form>
        <Rule control={c} owner="a" required verdictOut={(v) => (verdict = v)} />
      </Form>,
    );
    expect(errorsOf(c)[requiredKey("a")]).toBe("Required");
    expect(errorsOf(verdict)[requiredKey("a")]).toBe("Required");
    act(() => dom.ctx.update((wc) => wc.setValue(c, "x")));
    expect(errorsOf(c)[requiredKey("a")]).toBeFalsy();
    expect(errorsOf(verdict)[requiredKey("a")]).toBeFalsy();
  });

  it("key required per boundary, so one boundary cannot clear another's", () => {
    const c = dom.ctx.newControl("");
    dom.mount(
      <Form>
        <Rule control={c} owner="a" required />
        <Rule control={c} owner="b" />
      </Form>,
    );
    expect(errorsOf(c)[requiredKey("a")]).toBe("Required");
    expect(errorsOf(c)[requiredKey("b")]).toBeFalsy();
  });

  it("publish nothing while inactive, and clear on unmount", () => {
    const c = dom.ctx.newControl("");
    dom.mount(
      <Form>
        <Rule control={c} owner="a" required active={false} />
      </Form>,
    );
    expect(errorsOf(c)[requiredKey("a")]).toBeFalsy();
    dom.mount(
      <Form>
        <Rule control={c} owner="a" required />
      </Form>,
    );
    expect(errorsOf(c)[requiredKey("a")]).toBe("Required");
    dom.unmount();
    expect(errorsOf(c)[requiredKey("a")]).toBeFalsy();
  });

  it("re-run on a dependency read before the first await", () => {
    const c = dom.ctx.newControl("x");
    const other = dom.ctx.newControl(false);
    dom.mount(
      <Form>
        <Rule
          control={c}
          owner="a"
          validate={{ dep: (_v, rc) => (rc.getValue(other) ? "Other set" : null) }}
        />
      </Form>,
    );
    expect(errorsOf(c).dep).toBeFalsy();
    act(() => dom.ctx.update((wc) => wc.setValue(other, true)));
    expect(errorsOf(c).dep).toBe("Other set");
  });
});

describe("asynchronous validators", () => {
  const slow =
    (ms: number): Validator<string> =>
    async (v) => {
      await new Promise((r) => setTimeout(r, ms));
      return v === "bad" ? "Taken" : null;
    };

  it("count as pending in every enclosing scope until they answer", async () => {
    const c = dom.ctx.newControl("bad");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="p">
          <Rule control={c} owner="a" validate={{ taken: slow(30) }} />
        </Scope>
      </Owner>,
    );
    const page = root.find(untrackedRead, "p")!;
    expect(page.pending(untrackedRead)).toBe(true);
    expect(root.pending(untrackedRead)).toBe(true);
    // Optimistic while pending: nothing has been published yet.
    expect(page.isValid(untrackedRead)).toBe(true);
    await flush(50);
    expect(root.pending(untrackedRead)).toBe(false);
    expect(page.isValid(untrackedRead)).toBe(false);
    expect(errorsOf(c).taken).toBe("Taken");
  });

  it("drop a superseded answer", async () => {
    const c = dom.ctx.newControl("bad");
    dom.mount(
      <Form>
        <Rule control={c} owner="a" validate={{ taken: slow(30) }} />
      </Form>,
    );
    act(() => dom.ctx.update((wc) => wc.setValue(c, "fine")));
    await flush(60);
    expect(errorsOf(c).taken).toBeFalsy();
  });
});

describe("check()", () => {
  it("waits for pending validators, touches everything if invalid, and reports", async () => {
    const c = dom.ctx.newControl("bad");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Rule
          control={c}
          owner="a"
          validate={{
            taken: async (v) => {
              await new Promise((r) => setTimeout(r, 20));
              return v === "bad" ? "Taken" : null;
            },
          }}
        />
      </Owner>,
    );
    let result: boolean | undefined;
    await act(async () => {
      result = await root.check();
    });
    expect(result).toBe(false);
    expect(untrackedRead.isTouched(c)).toBe(true);
  });

  it("resolves true, touching nothing, when everything is valid", async () => {
    const c = dom.ctx.newControl("ok");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Rule control={c} owner="a" required />
      </Owner>,
    );
    let result: boolean | undefined;
    await act(async () => {
      result = await root.check();
    });
    expect(result).toBe(true);
    expect(untrackedRead.isTouched(c)).toBe(false);
  });
});

describe("a scope judges only its own rules", () => {
  it("is not invalid because a rule elsewhere fails for a field it also shows", () => {
    const email = dom.ctx.newControl("");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="details">
          <Rule control={email} owner="requires" required />
        </Scope>
        <Scope name="detail">
          <Rule control={email} owner="shows" />
        </Scope>
      </Owner>,
    );
    const rc = untrackedRead;
    expect(root.find(rc, "details")!.isValid(rc)).toBe(false);
    expect(root.find(rc, "detail")!.isValid(rc)).toBe(true);
    // The data itself carries every error.
    expect(rc.isValid(email)).toBe(false);
  });

  it("counts an error no rule wrote — a server rejection — everywhere", () => {
    const email = dom.ctx.newControl("a@b");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="one">
          <Rule control={email} owner="x" />
        </Scope>
        <Scope name="two">
          <Rule control={email} owner="y" />
        </Scope>
        <Scope name="unrelated">
          <Rule control={dom.ctx.newControl("")} owner="z" />
        </Scope>
      </Owner>,
    );
    const rc = untrackedRead;
    act(() => dom.ctx.update((wc) => wc.setError(email, "server", "Taken")));
    expect(root.find(rc, "one")!.isValid(rc)).toBe(false);
    expect(root.find(rc, "two")!.isValid(rc)).toBe(false);
    expect(root.find(rc, "unrelated")!.isValid(rc)).toBe(true);
    act(() => dom.ctx.update((wc) => wc.setError(email, "server", null)));
    expect(root.find(rc, "one")!.isValid(rc)).toBe(true);
  });

  it("does not count an unclaimed error on a field that is not validating", () => {
    const email = dom.ctx.newControl("a@b");
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="hiddenHere">
          <Rule control={email} owner="x" active={false} />
        </Scope>
      </Owner>,
    );
    act(() => dom.ctx.update((wc) => wc.setError(email, "server", "Taken")));
    expect(root.find(untrackedRead, "hiddenHere")!.isValid(untrackedRead)).toBe(
      true,
    );
  });

  it("treats a key another mounted boundary publishes as claimed, not as a server error", () => {
    const c = dom.ctx.newControl("bad");
    let root!: ValidationScope;
    const shape: Validator<string> = (v) => (v === "bad" ? "Bad shape" : null);
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="rules">
          <Rule control={c} owner="x" validate={{ shape }} />
        </Scope>
        <Scope name="shows">
          <Rule control={c} owner="y" />
        </Scope>
      </Owner>,
    );
    expect(root.find(untrackedRead, "rules")!.isValid(untrackedRead)).toBe(false);
    expect(root.find(untrackedRead, "shows")!.isValid(untrackedRead)).toBe(true);
  });
});

describe("the validation tree", () => {
  it("is rooted at the form and walked with children / child / find", () => {
    let root!: ValidationScope;
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="signup" kind="section">
          <Scope name="who">{null}</Scope>
          <Scope name="detail">{null}</Scope>
        </Scope>
      </Owner>,
    );
    const rc = untrackedRead;
    expect(root.kind).toBe("form");
    expect(root.root).toBe(root);
    const signup = root.child(rc, "signup")!;
    expect(signup.children(rc).map((c) => c.key)).toEqual(["who", "detail"]);
    const who = root.find(rc, "who")!;
    expect(who.parent).toBe(signup);
    expect(who.root).toBe(root);
    expect(root.child(rc, "who")).toBeUndefined();
  });

  it("drops a child when its owner unmounts", () => {
    let root!: ValidationScope;
    const show = (on: boolean) => (
      <Owner out={(v) => (root = v)}>
        {on && <Scope name="gone">{null}</Scope>}
      </Owner>
    );
    dom.mount(show(true));
    expect(root.child(untrackedRead, "gone")).toBeDefined();
    dom.mount(show(false));
    expect(root.child(untrackedRead, "gone")).toBeUndefined();
  });

  it("attaches each child once under StrictMode", () => {
    let root!: ValidationScope;
    dom.mount(
      <StrictMode>
        <Owner out={(v) => (root = v)}>
          <Scope name="p">{null}</Scope>
        </Owner>
      </StrictMode>,
    );
    expect(root.children(untrackedRead).map((c) => c.key)).toEqual(["p"]);
  });

  it("is reachable from inside with useValidation()", () => {
    let inner!: ValidationScope;
    let root!: ValidationScope;
    function Inside() {
      inner = useValidation();
      return null;
    }
    dom.mount(
      <Owner out={(v) => (root = v)}>
        <Scope name="p">
          <Inside />
        </Scope>
      </Owner>,
    );
    expect(inner.key).toBe("p");
    expect(inner.root).toBe(root);
  });

  it("throws from useValidation() outside a <Form>", () => {
    function Outside() {
      useValidation();
      return null;
    }
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => dom.mount(<Outside />)).toThrow(/needs a <Form>/);
    } finally {
      console.error = orig;
    }
  });
});

describe("the default-value cycle", () => {
  function Defaulted({
    c,
    presence = "rendered",
    hidden,
  }: {
    c: Control<string | null | undefined>;
    presence?: Presence;
    hidden?: () => boolean | undefined;
  }) {
    const parent = useFormScope();
    const scope = narrowScope(parent, { presence });
    return (
      <FormScopeProvider scope={scope}>
        <Inner c={c} hidden={hidden} />
      </FormScopeProvider>
    );
  }
  function Inner({
    c,
    hidden,
  }: {
    c: Control<string | null | undefined>;
    hidden?: () => boolean | undefined;
  }) {
    useDefaultValue(c, "dflt", useFormScope(), true, hidden);
    return null;
  }

  it("writes the default while shown and undefined", () => {
    const c = dom.ctx.newControl<string | null | undefined>(undefined);
    dom.mount(<Defaulted c={c} />);
    expect(untrackedRead.getValue(c)).toBe("dflt");
  });

  it("leaves null alone — null is a value", () => {
    const c = dom.ctx.newControl<string | null | undefined>(null);
    dom.mount(<Defaulted c={c} />);
    expect(untrackedRead.getValue(c)).toBeNull();
  });

  it("writes nothing while hidden, or while hidden is pending", () => {
    const c = dom.ctx.newControl<string | null | undefined>(undefined);
    dom.mount(<Defaulted c={c} presence="hidden" />);
    expect(untrackedRead.getValue(c)).toBeUndefined();
    dom.mount(<Defaulted c={c} hidden={() => undefined} />);
    expect(untrackedRead.getValue(c)).toBeUndefined();
  });

  it("defaults again once the value is cleared", () => {
    const c = dom.ctx.newControl<string | null | undefined>(undefined);
    dom.mount(<Defaulted c={c} />);
    act(() => dom.ctx.update((wc) => wc.setValue(c, undefined)));
    expect(untrackedRead.getValue(c)).toBe("dflt");
  });
});
