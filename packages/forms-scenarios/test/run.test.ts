import { describe, expect, it } from "vitest";
import {
  choose,
  compareRuns,
  expectAction,
  expectData,
  expectHidden,
  expectVisible,
  fill,
  findField,
  findText,
  findToggle,
  press,
  runScenario,
  toggle,
  type Report,
  type ScreenNode,
  type Target,
} from "../src/index.js";

const node = (o: Partial<ScreenNode>): ScreenNode => ({
  text: "",
  desc: "",
  cls: "android.view.View",
  id: "",
  clickable: false,
  checkable: false,
  checked: false,
  enabled: true,
  x: 0,
  y: 0,
  w: 100,
  h: 20,
  ...o,
});

/**
 * A pretend app: a name field, a "Text me" switch, a Phone / Email radio and a
 * Continue that needs a name — drawn from its own state, reporting as an app does.
 */
function fakeApp(name = "fake", opts: { extra?: string } = {}): Target & { taps: string[] } {
  let data: Record<string, unknown> = {};
  const actions: Report["actions"] = [];
  let error = false;
  let focused = false;
  const taps: string[] = [];
  const draw = (): ScreenNode[] => [
    node({ text: "Name *" }),
    node({ cls: "android.widget.EditText", text: (data.name as string) ?? "", clickable: true }),
    ...(error ? [node({ text: "Name is required" })] : []),
    node({ desc: "Text me", checkable: true, checked: !!data.sms, clickable: true }),
    node({ text: "How should we reply?" }),
    node({ text: "Phone", clickable: true }),
    node({ text: "Email", clickable: true }),
    node({ text: "Continue", clickable: true }),
    node({ text: "\uF05A" }),
    ...(opts.extra ? [node({ text: opts.extra })] : []),
  ];
  return {
    name,
    taps,
    async open(_form, d) {
      data = { ...(d as object) };
    },
    async screen() {
      return draw();
    },
    async tap(n) {
      const l = n.text || n.desc || n.cls;
      taps.push(l);
      focused = n.cls.endsWith("EditText");
      if (l === "Text me") data.sms = !data.sms;
      if (l === "Phone" || l === "Email") data.reply = l.toLowerCase();
      if (l === "Continue") {
        error = !data.name;
        if (!error) actions.push({ actionId: "next" });
      }
    },
    async type(text) {
      if (focused) data.name = text;
    },
    async report() {
      return { data, actions };
    },
    async close() {},
  };
}

describe("the screen queries", () => {
  const nodes = [
    node({ text: "Family name *" }),
    node({ cls: "android.widget.EditText" }),
    node({ desc: "Save card, unchecked", checkable: true }),
    node({ text: "Alerts" }),
    node({ cls: "android.widget.Switch", checkable: true }),
  ];
  it("finds words ignoring a required marker, and a row by its accessible name's start", () => {
    expect(findText(nodes, "Family name")).toBe(nodes[0]);
    expect(findText(nodes, "Save card")).toBe(nodes[2]);
  });
  it("finds a field after its label and a toggle by name or after its label", () => {
    expect(findField(nodes, "Family name")).toBe(nodes[1]);
    expect(findToggle(nodes, "Save card")).toBe(nodes[2]);
    expect(findToggle(nodes, "Alerts")).toBe(nodes[4]);
  });
});

describe("runScenario", () => {
  it("acts and checks through the screen and the reported data", async () => {
    const app = fakeApp();
    const r = await runScenario(
      {
        name: "contact",
        form: "Contact",
        steps: [
          press("Continue"),
          expectVisible("Name is required"),
          expectHidden("Saved"),
          fill("Name", "Ada"),
          toggle("Text me"),
          choose("How should we reply?", "Email"),
          press("Continue"),
          expectHidden("Name is required"),
          expectData("name", "Ada"),
          expectData("sms", true),
          expectData("reply", "email"),
          expectAction("next"),
        ],
      },
      app,
    );
    expect(r.steps.filter((s) => !s.ok)).toEqual([]);
    expect(r.ok).toBe(true);
    // Snapshots leave icon glyphs out.
    expect(r.steps.at(-1)!.texts).not.toContain("\uF05A");
  });

  it("tells a watcher each step as it starts and as it ends", async () => {
    const seen: string[] = [];
    await runScenario(
      { name: "x", form: "X", steps: [press("Continue"), expectVisible("Nope")] },
      fakeApp(),
      { onStep: (r, i) => seen.push(`${i}:${r.ok === undefined ? "start" : r.ok ? "ok" : "failed"}`) },
    );
    expect(seen).toEqual(["0:start", "0:ok", "1:start", "1:failed"]);
  });

  it("stops at the first step that fails, saying why", async () => {
    const r = await runScenario(
      { name: "x", form: "X", steps: [expectData("name", "Ada"), press("Continue")] },
      fakeApp(),
    );
    expect([r.ok, r.steps[0]!.ok, r.steps[0]!.message, r.steps[1]!.ok]).toEqual([
      false,
      false,
      'name is null, not "Ada"',
      undefined,
    ]);
  });

  it("compares two runs: words and data that differ, step by step", async () => {
    const s = { name: "x", form: "X", steps: [fill("Name", "Ada")] };
    const a = await runScenario(s, fakeApp("legacy"));
    const b = await runScenario(s, fakeApp("v2", { extra: "Optional" }));
    expect(compareRuns(a, b)).toEqual([
      { step: 'fill "Name" with "Ada"', ok: [true, true], onlyFirst: [], onlySecond: ["Optional"], data: [] },
    ]);
  });
});
