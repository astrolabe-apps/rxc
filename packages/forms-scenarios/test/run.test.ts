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
  label,
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
      { wait: 0, onStep: (r, i) => seen.push(`${i}:${r.ok === undefined ? "start" : r.ok ? "ok" : "failed"}`) },
    );
    expect(seen).toEqual(["0:start", "0:ok", "1:start", "1:failed"]);
  });

  it("scrolls a target whose screen shows only part of the form to find what a step needs", async () => {
    const app = fakeApp();
    // Only the first three elements fit; scrolling moves the window by two.
    let top = 0;
    const all = app.screen.bind(app);
    const scrolled = {
      ...app,
      screen: async () => (await all()).slice(top, top + 3),
      scroll: async (d: "down" | "up") => {
        top = Math.max(0, Math.min(6, top + (d === "down" ? 2 : -2)));
      },
    };
    const r = await runScenario(
      { name: "x", form: "X", steps: [press("Continue"), expectVisible("Name *"), expectAction("next")] },
      { ...scrolled, open: async () => { top = 0; } },
      { wait: 0 },
    );
    // Continue is found below, then the name field above it again.
    expect(r.steps.map((s) => s.ok)).toEqual([true, true, false]);
  });

  it("finds a field the last step revealed late, below where its first scan of the form ended", async () => {
    // The form shows three elements at a time. Switching on "Text me" adds a field at the
    // form's end, but the app draws it only a few screen reads later — after a scan that
    // looked for it has already reached the end and turned back up.
    let sms = false;
    let readsSinceTap = 0;
    let top = 0;
    let typed = "";
    const draw = (): ScreenNode[] => [
      node({ text: "Name *" }),
      node({ cls: "android.widget.EditText", clickable: true }),
      node({ desc: "Text me", checkable: true, checked: sms, clickable: true }),
      node({ text: "How should we reply?" }),
      node({ text: "Phone", clickable: true }),
      node({ text: "Continue", clickable: true }),
      ...(sms && readsSinceTap > 4
        ? [node({ text: "Mobile number" }), node({ cls: "android.widget.EditText", text: typed, clickable: true })]
        : []),
    ];
    const app: Target = {
      name: "late",
      async open() {
        top = 0;
      },
      async screen() {
        readsSinceTap++;
        const all = draw();
        top = Math.min(top, Math.max(0, all.length - 3));
        return all.slice(top, top + 3);
      },
      async scroll(d) {
        top = Math.max(0, top + (d === "down" ? 2 : -2));
      },
      async tap(n) {
        if (n.desc === "Text me") sms = !sms;
        readsSinceTap = 0;
      },
      async type(text) {
        typed = text;
      },
      async report() {
        return { data: { sms }, actions: [] };
      },
      async close() {},
    };
    const r = await runScenario(
      { name: "x", form: "X", steps: [toggle("Text me"), fill("Mobile number", "0400")] },
      app,
      { wait: 0 },
    );
    expect(r.steps.map((s) => [s.ok, s.message])).toEqual([
      [true, undefined],
      [true, undefined],
    ]);
  });

  it("stops at the first step that fails, saying why", async () => {
    const r = await runScenario(
      { name: "x", form: "X", steps: [expectData("name", "Ada"), press("Continue")] },
      fakeApp(),
      { wait: 0 },
    );
    expect([r.ok, r.steps[0]!.ok, r.steps[0]!.message, r.steps[1]!.ok]).toEqual([
      false,
      false,
      'name is null, not "Ada"',
      undefined,
    ]);
  });

  it("reads the screen again only once something has been done to it", async () => {
    const app = fakeApp();
    let reads = 0;
    const screen = app.screen;
    app.screen = async () => (reads++, screen());
    const r = await runScenario(
      {
        name: "x",
        form: "X",
        steps: [expectVisible("Name *"), expectHidden("Saved"), expectVisible("Continue"), press("Continue")],
      },
      app,
    );
    expect(r.ok).toBe(true);
    // One read for the three checks and the press's search, one after the press.
    expect(reads).toBe(2);
  });

  it("waits for what the app shows, and the data it reports, in its own time", async () => {
    const app = fakeApp();
    // The app answers a press a few reads later.
    let late = 0;
    const screen = app.screen;
    const report = app.report;
    app.screen = async () => [...(await screen()), ...(late && ++late > 3 ? [node({ text: "Saved" })] : [])];
    // And reports its data a few looks later again.
    let looks = 0;
    app.report = async () => {
      const r = await report();
      return late && ++looks > 3 ? r : { ...r, data: {}, actions: [] };
    };
    const tap = app.tap;
    app.tap = async (n) => {
      await tap(n);
      if (label(n) === "Continue") late = 1;
    };
    const r = await runScenario(
      {
        name: "x",
        form: "X",
        data: { name: "Ada" },
        steps: [press("Continue"), expectVisible("Saved"), expectData("name", "Ada"), expectAction("next")],
      },
      app,
    );
    expect(r.steps.map((s) => s.message)).toEqual([undefined, undefined, undefined, undefined]);
    // Not forever: what never comes fails once the wait is up.
    const start = Date.now();
    const f = await runScenario({ name: "x", form: "X", steps: [expectVisible("Never")] }, fakeApp(), { wait: 500 });
    expect([f.ok, Date.now() - start >= 500]).toEqual([false, true]);
  });

  it("leaves a filled field by tapping its label, so the next tap is not taken as dismissing the keyboard", async () => {
    const app = fakeApp();
    const r = await runScenario(
      { name: "x", form: "X", steps: [fill("Name", "Ada"), expectData("name", "Ada")] },
      app,
    );
    expect(r.ok).toBe(true);
    expect(app.taps).toEqual(["android.widget.EditText", "Name *"]);
  });

  it("reads a filled field back and retypes once when the keyboard added to it", async () => {
    const app = fakeApp();
    let typed = 0;
    const type = app.type;
    // The first attempt lands with a trailing space, as a suggestion commit leaves it.
    app.type = async (text, current) => type(++typed === 1 ? `${text} ` : text, current);
    const r = await runScenario(
      { name: "x", form: "X", steps: [fill("Name", "Ada"), expectData("name", "Ada")] },
      app,
    );
    expect(r.ok).toBe(true);
    expect(typed).toBe(2);
    // The second tap is on the field as it then reads, "Ada ".
    expect(app.taps).toEqual(["android.widget.EditText", "Name *", "Ada ", "Name *"]);
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
