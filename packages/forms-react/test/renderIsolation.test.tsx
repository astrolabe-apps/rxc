import { beforeEach, describe, expect, it } from "vitest";
import { act, useState, type ComponentType, type ReactNode } from "react";
import { untrackedRead, type Control } from "@rx-controls/core";
import { useReactive, type Rendered } from "@rx-controls/react";
import {
  Action,
  Dialog,
  Elements,
  Form,
  FormProvider,
  Section,
  Tabs,
  TextDisplay,
  TextField,
  Wizard,
  type FormRenderers,
} from "../src/index";
import { setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

/**
 * Render counts: what re-renders when one thing moves. Every slot is wrapped
 * in a counter keyed by the slot and the instance, so a test reads exactly
 * which implementation components ran.
 */
const dom = setupDom();
const renders = new Map<string, number>();
beforeEach(() => renders.clear());

function counted<P>(slot: string, Impl: ComponentType<P>, key: (p: P) => unknown) {
  function Counted(p: P & object) {
    const k = `${slot}:${String(key(p))}`;
    renders.set(k, (renders.get(k) ?? 0) + 1);
    // Called, not mounted: its hooks become this component's, so a re-render
    // its own subscription drives is counted too.
    return (Impl as unknown as (p: P) => ReactNode)(p);
  }
  return Counted as unknown as ComponentType<P>;
}
const r = testRenderers;
const countingRenderers: FormRenderers = {
  ...r,
  textfield: counted("field", r.textfield, (p) => p.id),
  action: counted("action", r.action, (p) => p.actionId),
  text: counted("text", r.text, (p) => p.accessibleName),
  elements: counted("elements", r.elements, (p) => p.id),
  contents: counted("group", r.contents, (p) => p.title),
  tabs: counted("tabs", r.tabs, () => "strip"),
  wizard: counted("wizard", r.wizard, () => "wizard"),
  dialog: counted("dialog", r.dialog, (p) => p.title),
};

const snapshot = () => new Map(renders);
/** The keys whose count moved since `before`. */
function moved(before: Map<string, number>): string[] {
  return [...renders.keys()]
    .filter((k) => renders.get(k) !== before.get(k))
    .sort();
}
const set = <T,>(c: Control<T>, v: T) =>
  act(() => dom.ctx.update((wc) => wc.setValue(c, v)));

type Data = { a: string; b: string; rows: { n: string }[]; t1: string; t2: string };

let bump: () => void = () => {};
/** An author that re-renders on demand, passing the same props each time. */
function Author({ data, open }: { data: Control<Data>; open: Control<boolean> }): Rendered {
  const { rendered } = useReactive();
  const [, setN] = useState(0);
  bump = () => setN((n) => n + 1);
  const f = data.fields;
  return rendered(
    <Form>
      <TextField field={f.a} id="a" label="A" />
      <TextField field={f.b} id="b" label="B" />
      <TextDisplay text="static" accessibleName="note" />
      <Action actionId="go" text="Go" />
      <Elements field={f.rows} id="rows" children={row} />
      <Section title="section">
        <TextField field={f.a} id="a-in-section" label="A again" />
      </Section>
      <Tabs items={tabItems(f)} />
      <Wizard items={pageItems(f)} />
      <Dialog open={open} title="dialog">
        <TextField field={f.b} id="b-in-dialog" />
      </Dialog>
    </Form>,
  );
}
// Stable across the author's renders: a render prop written outside it.
const row = (c: Control<{ n: string }>, i: number) => (
  <TextField field={c.fields.n} id={`row${i}`} />
);
const tabItems = (f: Control<Data>["fields"]) => [
  { key: "one", title: "One", children: <TextField field={f.t1} id="t1" /> },
  { key: "two", title: "Two", children: <TextField field={f.t2} id="t2" /> },
];
const pageItems = (f: Control<Data>["fields"]) => [
  { key: "p1", title: "P1", children: <TextField field={f.t1} id="p1" /> },
  { key: "p2", title: "P2", children: <TextField field={f.t2} id="p2" /> },
];

function mount(): { data: Control<Data>; open: Control<boolean> } {
  const data = dom.ctx.newControl<Data>({
    a: "a",
    b: "b",
    rows: [{ n: "x" }, { n: "y" }],
    t1: "1",
    t2: "2",
  });
  const open = dom.ctx.newControl(false);
  dom.mount(
    <FormProvider renderers={countingRenderers}>
      <Author data={data} open={open} />
    </FormProvider>,
  );
  return { data, open };
}

describe("render isolation", () => {
  it("a value change re-renders the fields bound to it and nothing else", () => {
    const { data } = mount();
    const before = snapshot();
    set(data.fields.a, "changed");
    expect(moved(before)).toEqual(["field:a", "field:a-in-section"]);
  });

  it("a value change inside a container re-renders the field, not the container", () => {
    const { data } = mount();
    const before = snapshot();
    set(data.fields.t2, "changed");
    set(data.fields.b, "changed");
    expect(moved(before)).toEqual(["field:b", "field:b-in-dialog", "field:p2", "field:t2"]);
  });

  it("one row's change re-renders that row, not the collection or its siblings", () => {
    const { data } = mount();
    const before = snapshot();
    const row1 = untrackedRead.getElements(data.fields.rows)[1];
    set(row1.fields.n, "changed");
    expect(moved(before)).toEqual(["field:row1"]);
  });

  it("an author re-render with unchanged props bails out at every leaf boundary", () => {
    mount();
    const before = snapshot();
    act(() => bump());
    // Fields, displays, actions and the collection (a stable render prop)
    // compare their props and stop. Containers take fresh `children` /
    // `items` every render, so they re-render — and the boundaries inside
    // them bail out in turn.
    expect(moved(before)).toEqual([
      "dialog:dialog",
      "group:section",
      "tabs:strip",
      "wizard:wizard",
    ]);
  });
});
