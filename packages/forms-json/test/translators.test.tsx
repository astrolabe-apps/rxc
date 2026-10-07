import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { untrackedRead as rc } from "@rx-controls/core";
import type { SchemaField } from "@rx-controls/forms-schema";
import { Contents, TextField } from "@rx-controls/forms-react";
import {
  defaultTranslators,
  LoaderStrictError,
  translateForm,
  type Translator,
} from "../src/index";
import { click, flush, setupLoader, typeInto } from "./harness";

/**
 * One section per translator in `defaultTranslators`, then the parts of the
 * loader every translator shares: expressions, validators, dynamic
 * properties, adornments, host extensions and the audit. Each uses the
 * smallest definition that shows the behaviour, through the real html
 * implementation.
 */
const h = setupLoader();
const $ = <E extends Element = HTMLElement>(sel: string) =>
  h.container.querySelector(sel) as E;
const $$ = (sel: string) => [...h.container.querySelectorAll(sel)];
const text = () => h.container.textContent ?? "";
const kinds = (ws: { kind: string }[]) => ws.map((w) => w.kind);
const button = (label: string) =>
  $$("button").find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

const str = (field: string, extra: Partial<SchemaField> = {}): SchemaField => ({
  field,
  type: "String",
  ...extra,
});
const statusField = str("status", {
  displayName: "Status",
  options: [
    { name: "Active", value: "active" },
    { name: "Inactive", value: "inactive" },
  ],
});

describe("TextField", () => {
  it("labels from the schema, and carries required, placeholder and multiline", () => {
    const { warnings } = h.load(
      [
        {
          type: "Data",
          field: "name",
          required: true,
          renderOptions: { type: "Textfield", placeholder: "Given name" },
        },
        { type: "Data", field: "notes", renderOptions: { type: "Multiline" } },
      ],
      [str("name", { displayName: "Name" }), str("notes")],
      { name: "", notes: "x" },
    );
    expect(warnings).toEqual([]);
    expect(text()).toContain("Name");
    expect($<HTMLInputElement>("input").placeholder).toBe("Given name");
    expect($<HTMLTextAreaElement>("textarea").value).toBe("x");
  });

  it("maps the class slots, with legacy's \"@ \" prefix as replace", () => {
    h.load(
      [
        {
          type: "Data",
          field: "name",
          styleClass: "extra",
          layoutClass: "@ only-this",
        },
      ],
      [str("name")],
      { name: "" },
    );
    // The default theme puts the control's class on its frame.
    expect($$(".extra").length).toBe(1);
    expect($$(".only-this").length).toBe(1);
  });

  it("keeps a hidden title as the field's name, not drawn, for hideTitle", () => {
    const { warnings } = h.load(
      [{ type: "Data", field: "name", title: "Hidden label", hideTitle: true }],
      [str("name")],
      { name: "" },
    );
    expect(warnings).toEqual([]);
    // Legacy drew no label and left the input unnamed; it is named now.
    const input = $<HTMLInputElement>("input");
    const label = $(`label[for="${input.id}"]`);
    expect(label.textContent).toBe("Hidden label");
    expect(label.style.clipPath).toBe("inset(50%)");
  });

  it("drops a compound's hidden title: a group's title names nothing", () => {
    const { warnings } = h.load(
      [
        {
          type: "Data",
          field: "address",
          title: "Address section",
          hideTitle: true,
          children: [{ type: "Data", field: "street" }],
        },
      ],
      [{ field: "address", type: "Compound", children: [str("street", { displayName: "Street" })] }],
      { address: { street: "" } },
    );
    expect(warnings).toEqual([]);
    expect(text()).not.toContain("Address section");
    expect(text()).toContain("Street");
  });
});

describe("SelectField", () => {
  it("takes its options from the schema, and round-trips a number", () => {
    const { data } = h.load(
      [{ type: "Data", field: "priority" }],
      [
        {
          field: "priority",
          type: "Int",
          options: [
            { name: "Low", value: 1 },
            { name: "High", value: 3 },
          ],
        },
      ],
      { priority: undefined as number | undefined },
    );
    const select = $<HTMLSelectElement>("select");
    expect([...select.options].map((o) => o.text)).toContain("High");
    act(() => {
      select.value = "3";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(rc.getValue(data).priority).toBe(3);
  });

  it("narrows the schema's options by an AllowedOptions expression", async () => {
    const { data } = h.load(
      [
        {
          type: "Data",
          field: "status",
          renderOptions: { type: "Dropdown" },
          dynamic: [
            {
              type: "AllowedOptions",
              expr: {
                type: "Jsonata",
                expression: "['active', flag ? 'inactive' : null]",
              },
            },
          ],
        },
      ],
      [statusField, { field: "flag", type: "Bool" }],
      { status: undefined, flag: false },
    );
    await flush();
    const names = () => [...$<HTMLSelectElement>("select").options].map((o) => o.text);
    expect(names()).toContain("Active");
    expect(names()).not.toContain("Inactive");
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.flag, true)));
    await flush();
    expect(names()).toContain("Inactive");
  });
});

describe("RadioField", () => {
  it("translates per-option children with $formData.option and optionSelected", async () => {
    h.load(
      [
        {
          type: "Data",
          field: "status",
          renderOptions: { type: "Radio" },
          children: [
            {
              type: "Display",
              displayData: { type: "Text", text: "" },
              dynamic: [
                {
                  type: "Display",
                  expr: {
                    type: "Jsonata",
                    expression:
                      "{'active': 'A current member.', 'inactive': 'Lapsed.'}.$lookup($formData.option.value)",
                  },
                },
              ],
            },
            {
              type: "Group",
              groupOptions: { type: "Contents" },
              dynamic: [
                {
                  type: "Visible",
                  expr: { type: "Jsonata", expression: "$formData.optionSelected" },
                },
              ],
              children: [
                { type: "Display", displayData: { type: "Text", text: "Chosen detail" } },
              ],
            },
          ],
        },
      ],
      [statusField],
      { status: "inactive" },
    );
    await flush();
    expect(text()).toContain("A current member.");
    expect(text()).toContain("Lapsed.");
    // The detail group is mounted under every option and shown under the chosen one.
    const shown = $$("[data-hidden]").length;
    expect(shown).toBeGreaterThan(0);
    expect($$("input[type=radio]").length).toBe(2);
  });

  it("builds whole options from AllowedOptions when the schema has none", async () => {
    h.load(
      [
        {
          type: "Data",
          field: "hasPets",
          renderOptions: { type: "Radio" },
          dynamic: [
            {
              type: "AllowedOptions",
              expr: {
                type: "Jsonata",
                expression: '[{"name": "Yes", "value": true}, {"name": "No", "value": false}]',
              },
            },
          ],
        },
      ],
      [{ field: "hasPets", type: "Bool" }],
      { hasPets: undefined },
    );
    await flush();
    expect(text()).toContain("Yes");
    expect(text()).toContain("No");
  });
});

describe("CheckListField", () => {
  it("is legacy's CheckList over a collection with options, ticking values into the array", () => {
    const { data, warnings } = h.load(
      [{ type: "Data", field: "days", renderOptions: { type: "CheckList" } }],
      [
        {
          field: "days",
          type: "Int",
          collection: true,
          options: [
            { name: "Mon", value: 1 },
            { name: "Tue", value: 2 },
          ],
        },
      ],
      { days: [] as number[] },
    );
    const boxes = $$("input[type=checkbox]") as HTMLInputElement[];
    expect(boxes).toHaveLength(2);
    act(() => boxes[1]!.click());
    // The option's own value, a number — not the string the DOM carries.
    expect(rc.getValue(data).days).toEqual([2]);
    expect(warnings).toEqual([]);
  });
});

describe("CheckboxField", () => {
  it("is the widget for a Bool", () => {
    const { data } = h.load(
      [{ type: "Data", field: "ok", title: "OK" }],
      [{ field: "ok", type: "Bool" }],
      { ok: false },
    );
    click($("input[type=checkbox]"));
    expect(rc.getValue(data).ok).toBe(true);
  });
});

describe("DisplayOnlyField", () => {
  it("names options, formats booleans, and shows empty text", () => {
    h.load(
      [
        { type: "Data", field: "status", renderOptions: { type: "DisplayOnly" } },
        { type: "Data", field: "ok", renderOptions: { type: "DisplayOnly" } },
        {
          type: "Data",
          field: "missing",
          renderOptions: { type: "DisplayOnly", emptyText: "(none)" },
        },
      ],
      [statusField, { field: "ok", type: "Bool" }, str("missing")],
      { status: "active", ok: true, missing: "" },
    );
    expect(text()).toContain("Active");
    expect(text()).toContain("Yes");
    expect(text()).toContain("(none)");
  });
});

describe("a compound as a group", () => {
  const address: SchemaField = {
    field: "address",
    type: "Compound",
    children: [str("street"), str("city")],
  } as SchemaField;

  it("binds its children inside the compound, and ../x climbs back out", () => {
    const { data } = h.load(
      [
        {
          type: "Data",
          field: "address",
          renderOptions: { type: "Group", groupOptions: { type: "Flex" } },
          children: [
            { type: "Data", field: "street" },
            {
              type: "Data",
              field: "../name",
              renderOptions: { type: "DisplayOnly" },
            },
          ],
        },
        { type: "Data", field: "address/city" },
      ],
      [str("name"), address],
      { name: "Ada", address: { street: "Main", city: "Hobart" } },
    );
    expect(text()).toContain("Ada");
    const inputs = $$("input") as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(["Main", "Hobart"]);
    typeInto(inputs[0], "High");
    expect(rc.getValue(data).address.street).toBe("High");
  });

  it("clears its own value when hidden under clearHidden, and defaults it when shown", () => {
    const { data } = h.load(
      [
        { type: "Data", field: "show" },
        {
          type: "Data",
          field: "address",
          defaultValue: {},
          dynamic: [{ type: "Visible", expr: { type: "Data", field: "show" } }],
          children: [{ type: "Data", field: "street" }],
        },
      ],
      [{ field: "show", type: "Bool" }, address],
      { show: true, address: { street: "Main", city: "" } } as {
        show: boolean;
        address: unknown;
      },
      { clearHidden: true },
    );
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.show, false)));
    expect(rc.getValue(data).address).toBeUndefined();
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.show, true)));
    expect(rc.getValue(data).address).toEqual({});
  });
});

describe("a collection", () => {
  const pets: SchemaField = {
    field: "pets",
    type: "Compound",
    collection: true,
    children: [str("name")],
  } as SchemaField;

  it("renders a row per element with Remove, an Add below, and $i / $$ in a row's jsonata", async () => {
    const { data, warnings } = h.load(
      [
        {
          type: "Data",
          field: "pets",
          renderOptions: { type: "Array", addText: "Add a pet", noReorder: true },
          children: [
            { type: "Data", field: "name" },
            {
              type: "Display",
              displayData: { type: "Text", text: "" },
              dynamic: [
                {
                  type: "Display",
                  expr: {
                    type: "Jsonata",
                    expression: "'Pet ' & ($i + 1) & ' of ' & $count($$.pets)",
                  },
                },
              ],
            },
          ],
        },
      ],
      [pets],
      { pets: [{ name: "Rex" }, { name: "Tiddles" }] },
    );
    expect(warnings).toEqual([]);
    await flush();
    expect(text()).toContain("Pet 1 of 2");
    expect(text()).toContain("Pet 2 of 2");
    click(button("Add a pet"));
    expect(rc.getValue(data).pets).toHaveLength(3);
    click(button("Remove"));
    expect(rc.getValue(data).pets.map((p) => p?.name)).toEqual(["Tiddles", undefined]);
  });

  it("drops the buttons for noAdd / noRemove", () => {
    h.load(
      [
        {
          type: "Data",
          field: "pets",
          renderOptions: { type: "Array", noAdd: true, noRemove: true },
          children: [{ type: "Data", field: "name" }],
        },
      ],
      [pets],
      { pets: [{ name: "Rex" }] },
    );
    expect($$("button")).toHaveLength(0);
  });

  it("takes a Length validator as the array's bounds", () => {
    h.load(
      [
        {
          type: "Data",
          field: "pets",
          validators: [{ type: "Length", max: 1 }],
          children: [{ type: "Data", field: "name" }],
        },
      ],
      [pets],
      { pets: [{ name: "Rex" }] },
    );
    expect(button("Add").disabled).toBe(true);
  });
});

describe("groups", () => {
  it("draws Standard with a title, Inline as prose, Flex, and Tabs by child title", () => {
    h.load(
      [
        {
          type: "Group",
          title: "Standard group",
          groupOptions: { type: "Standard" },
          children: [{ type: "Display", displayData: { type: "Text", text: "in standard" } }],
        },
        {
          type: "Group",
          title: "No title shown",
          groupOptions: { type: "Inline", hideTitle: true },
          children: [{ type: "Display", displayData: { type: "Text", text: "inline prose" } }],
        },
        {
          type: "Group",
          groupOptions: { type: "Flex", direction: "row" },
          children: [{ type: "Display", displayData: { type: "Text", text: "in flex" } }],
        },
        {
          type: "Group",
          groupOptions: { type: "Tabs" },
          children: [
            { type: "Group", title: "First tab", groupOptions: { type: "Standard" }, children: [] },
            { type: "Group", title: "Second tab", groupOptions: { type: "Standard" }, children: [] },
          ],
        },
      ],
      [],
      {},
    );
    expect(text()).toContain("Standard group");
    expect(text()).not.toContain("No title shown");
    expect($$(".rxf-inline").length).toBe(1);
    expect(text()).toContain("in flex");
    expect(button("First tab")).toBeDefined();
    expect(button("Second tab")).toBeDefined();
  });

  it("takes a tab whose child is not Visible off the strip, as legacy did", () => {
    const { data } = h.load(
      [
        {
          type: "Group",
          groupOptions: { type: "Tabs" },
          children: [
            { type: "Group", title: "Always", groupOptions: { type: "Standard" }, children: [] },
            {
              type: "Group",
              title: "Sometimes",
              groupOptions: { type: "Standard" },
              dynamic: [
                { type: "Visible", expr: { type: "FieldValue", field: "show", value: true } },
              ],
              children: [],
            },
          ],
        },
      ],
      [{ field: "show", type: "Bool" }],
      { show: false as boolean },
    );
    expect(button("Always")).toBeDefined();
    expect(button("Sometimes")).toBeUndefined();
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.show, true)));
    expect(button("Sometimes")).toBeDefined();
    expect(h.console).toEqual([]);
  });

  it("keys tabs by position, so two with one title do not collide", () => {
    h.load(
      [
        {
          type: "Group",
          groupOptions: { type: "Tabs" },
          children: [
            { type: "Group", title: "Portal", groupOptions: { type: "Standard" }, children: [] },
            { type: "Group", title: "Portal", groupOptions: { type: "Standard" }, children: [] },
          ],
        },
      ],
      [],
      {},
    );
    expect($$("button").filter((b) => b.textContent === "Portal")).toHaveLength(2);
    expect(h.console).toEqual([]);
  });
});

describe("displays", () => {
  it("draws text, html and an icon named by its Tooltip", () => {
    h.load(
      [
        { type: "Display", displayData: { type: "Text", text: "plain text" } },
        { type: "Display", displayData: { type: "Html", html: "<b>bold</b>" } },
        {
          type: "Display",
          displayData: { type: "Icon", icon: { library: "fa-regular", name: "person" } },
          adornments: [{ type: "Tooltip", tooltip: "A person." }],
        },
      ],
      [],
      {},
    );
    expect(text()).toContain("plain text");
    expect($("b").textContent).toBe("bold");
    expect($("i.fa-regular.fa-person")).not.toBeNull();
    expect(h.container.innerHTML).toContain("A person.");
  });

  it("asks the host's displays map for a custom display by id, and reports one nobody answers", () => {
    const { warnings } = h.load(
      [
        { type: "Display", displayData: { type: "Custom", customId: "hello" } },
        { type: "Display", displayData: { type: "Custom", customId: "nobody" } },
      ],
      [],
      {},
      { displays: { hello: () => <p>Hello from the host</p> } },
    );
    expect(text()).toContain("Hello from the host");
    expect(warnings.map((w) => w.detail)).toEqual([
      'no host display for customId "nobody"',
    ]);
  });
});

describe("Action", () => {
  it("pairs the id with the host's handler, static and dynamic payloads, and reports an unclaimed id", () => {
    const calls: unknown[] = [];
    const { warnings } = h.load(
      [
        { type: "Action", actionId: "greet", actionText: "Static", actionData: "hello" },
        {
          type: "Action",
          actionId: "greet",
          actionText: "Dynamic",
          actionStyle: "Link",
          dynamic: [{ type: "ActionData", expr: { type: "Data", field: "name" } }],
        },
        { type: "Action", actionId: "launchRockets", actionText: "Unclaimed" },
      ],
      [str("name")],
      { name: "Ada" },
      {
        actionHandler: (id, d) =>
          id === "greet" ? () => void calls.push(d) : undefined,
      },
    );
    click(button("Static"));
    click(button("Dynamic"));
    expect(calls).toEqual(["hello", "Ada"]);
    expect(warnings.map((w) => [w.kind, w.subject])).toEqual([["action", "launchRockets"]]);
  });
});

describe("the Dialog group", () => {
  it("renders the trigger in place and opens and closes on its own action ids", () => {
    h.load(
      [
        {
          type: "Group",
          groupOptions: { type: "Dialog", title: "Edit notes" },
          children: [
            { type: "Action", actionId: "openDialog", actionText: "Open", placement: "trigger" },
            { type: "Data", field: "notes" },
            { type: "Action", actionId: "closeDialog", actionText: "Done" },
          ],
        },
      ],
      [str("notes")],
      { notes: "" },
    );
    const dialog = $<HTMLDialogElement>("dialog");
    expect(dialog.open).toBe(false);
    click(button("Open"));
    expect(dialog.open).toBe(true);
    click(button("Done"));
    expect(dialog.open).toBe(false);
  });
});

describe("expressions", () => {
  it("drives Visible from Data, NotEmpty and FieldValue synchronously", () => {
    const { data } = h.load(
      [
        { type: "Data", field: "a", title: "A", dynamic: [{ type: "Visible", expr: { type: "Data", field: "on" } }] },
        { type: "Data", field: "b", title: "B", dynamic: [{ type: "Visible", expr: { type: "NotEmpty", field: "a" } }] },
        { type: "Data", field: "c", title: "C", dynamic: [{ type: "Visible", expr: { type: "FieldValue", field: "a", value: "x" } }] },
      ],
      [{ field: "on", type: "Bool" }, str("a"), str("b"), str("c")],
      { on: false, a: "", b: "", c: "" },
    );
    const labels = () => $$("label").map((l) => l.textContent);
    expect(labels()).toEqual([]);
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.on, true)));
    expect(labels()).toEqual(["A"]);
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.a, "x")));
    expect(labels()).toEqual(["A", "B", "C"]);
  });

  it("treats a pending jsonata Visible as undecided: nothing is cleared before it answers", async () => {
    const { data } = h.load(
      [
        {
          type: "Data",
          field: "vet",
          dynamic: [{ type: "Visible", expr: { type: "Jsonata", expression: "pets = true" } }],
        },
      ],
      [{ field: "pets", type: "Bool" }, str("vet")],
      { pets: true, vet: "Dr. Dolittle" },
      { clearHidden: true },
    );
    await flush();
    expect(rc.getValue(data).vet).toBe("Dr. Dolittle");
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.pets, false)));
    await flush();
    expect(rc.getValue(data).vet).toBeUndefined();
  });

  it("reads Disabled, Label and DefaultValue", async () => {
    const { data } = h.load(
      [
        {
          type: "Data",
          field: "name",
          dynamic: [
            { type: "Disabled", expr: { type: "Data", field: "lock" } },
            { type: "Label", expr: { type: "Jsonata", expression: "'Name for ' & who" } },
            { type: "DefaultValue", expr: { type: "Data", field: "who" } },
          ],
        },
      ],
      [{ field: "lock", type: "Bool" }, str("who"), str("name")],
      { lock: true, who: "Ada", name: undefined as string | undefined },
    );
    await flush();
    expect(text()).toContain("Name for Ada");
    expect($<HTMLInputElement>("input").disabled).toBe(true);
    expect(rc.getValue(data).name).toBe("Ada");
  });

  it("reports a jsonata expression that does not compile", () => {
    const { warnings } = h.load(
      [{ type: "Data", field: "a", dynamic: [{ type: "Visible", expr: { type: "Jsonata", expression: "(((" } }] }],
      [str("a")],
      { a: "" },
    );
    expect(kinds(warnings)).toEqual(["expression"]);
  });
});

describe("validators", () => {
  it("enforces Length on a string, Jsonata's message and Date's NotAfter", async () => {
    const { data } = h.load(
      [
        { type: "Data", field: "code", validators: [{ type: "Length", max: 2 }] },
        {
          type: "Data",
          field: "notes",
          validators: [{ type: "Jsonata", expression: "$contains(notes, 'TODO') ? 'Has a TODO' : null" }],
        },
        {
          type: "Data",
          field: "when",
          validators: [{ type: "Date", comparison: "NotAfter", daysFromCurrent: 0 }],
        },
      ],
      [str("code"), str("notes"), { field: "when", type: "Date" }],
      { code: "abc", notes: "a TODO", when: "2999-01-01" },
    );
    await flush();
    const errors = (k: keyof typeof data.fields) =>
      Object.values(rc.getErrors(data.fields[k]));
    expect(errors("code")).toEqual(["At most 2"]);
    expect(errors("notes")).toEqual(["Has a TODO"]);
    expect(errors("when")[0]).toMatch(/^Date must not be after/);
  });

  it("reports a validator type it has no implementation of", () => {
    const { warnings } = h.load(
      [{ type: "Data", field: "a", validators: [{ type: "Luhn" }] }],
      [str("a")],
      { a: "" },
    );
    expect(kinds(warnings)).toEqual(["validator"]);
  });
});

describe("LayoutStyle", () => {
  it("makes a display toggle silent: off screen, still validating, never cleared", async () => {
    const { data, warnings } = h.load(
      [
        { type: "Data", field: "on" },
        {
          type: "Group",
          groupOptions: { type: "Standard" },
          dynamic: [
            { type: "LayoutStyle", expr: { type: "Jsonata", expression: 'on ? {} : {"display":"none"}' } },
          ],
          children: [{ type: "Data", field: "card", required: true }],
        },
      ],
      [{ field: "on", type: "Bool" }, str("card")],
      { on: false, card: "kept" },
      { clearHidden: true },
    );
    expect(warnings).toEqual([]);
    await flush();
    act(() => h.ctx.update((wc) => wc.setValue(data.fields.card, "")));
    expect(rc.getValue(data).card).toBe("");
    expect(rc.isValid(data.fields.card)).toBe(false);
    expect($$("input").length).toBe(2);
  });

  it("reports one that is not a toggle", () => {
    const { warnings } = h.load(
      [
        {
          type: "Group",
          groupOptions: { type: "Standard" },
          dynamic: [{ type: "LayoutStyle", expr: { type: "Jsonata", expression: '{"border-color": "red"}' } }],
          children: [],
        },
      ],
      [],
      {},
    );
    expect(kinds(warnings)).toEqual(["dynamic"]);
  });
});

describe("meta fields", () => {
  it("bind a side control, never the submitted value", () => {
    const { data } = h.load(
      [{ type: "Data", field: "showMore" }],
      [{ field: "showMore", type: "Bool", meta: true }],
      {} as Record<string, unknown>,
    );
    click($("input[type=checkbox]"));
    expect(rc.getValue(data)).toEqual({});
  });
});

describe("adornments", () => {
  it("turns HelpText into help text and a control-edge Icon into an icon slot", () => {
    const { warnings } = h.load(
      [
        {
          type: "Data",
          field: "a",
          adornments: [
            { type: "HelpText", helpText: "Some help.", placement: "LabelEnd" },
            { type: "Icon", placement: "ControlStart", icon: { library: "fa", name: "at" } },
          ],
        },
      ],
      [str("a")],
      { a: "" },
    );
    // LabelEnd is the contract's labelEnd: behind a Help button beside the
    // label, still the input's description.
    expect(warnings).toEqual([]);
    expect($('button[aria-label="Help"]')).not.toBeNull();
    const input = $<HTMLInputElement>("input");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Some help.",
    );
    expect($("i.fa.fa-at")).not.toBeNull();
  });

  it("draws HelpText at any other placement below the control", () => {
    h.load(
      [
        {
          type: "Data",
          field: "a",
          adornments: [{ type: "HelpText", helpText: "Some help.", placement: "ControlEnd" }],
        },
      ],
      [str("a")],
      { a: "" },
    );
    expect($('button[aria-label="Help"]')).toBeNull();
    expect(text()).toContain("Some help.");
  });

  it("wraps a control with an Accordion adornment in a disclosure, its title the toggle", () => {
    const { warnings } = h.load(
      [
        {
          type: "Display",
          title: "How to find this?",
          displayData: { type: "Text", text: "On the back of your card." },
          adornments: [{ type: "Accordion", title: "How to find this", defaultExpanded: false }],
        },
      ],
      [],
      {},
    );
    expect(warnings).toEqual([]);
    const details = $<HTMLDetailsElement>("details");
    expect([details.querySelector("summary")!.textContent, details.open]).toEqual([
      "How to find this",
      false,
    ]);
    // Closed, the content is mounted.
    expect(text()).toContain("On the back of your card.");
  });

  it("draws an Accordion group: title children as the toggle, open bound by expandStateField", () => {
    const { warnings, data } = h.load(
      [
        {
          type: "Group",
          title: "Browse",
          groupOptions: { type: "Accordion", hideTitle: true, expandStateField: "expanded" },
          children: [
            { type: "Display", placement: "title", displayData: { type: "Text", text: "Other services" } },
            { type: "Data", field: "name" },
          ],
        },
      ],
      [{ field: "expanded", type: "Bool" }, str("name", { displayName: "Name" })],
      { expanded: true, name: "" },
    );
    expect(warnings).toEqual([]);
    const details = $<HTMLDetailsElement>("details");
    expect([details.querySelector("summary")!.textContent, details.open]).toEqual([
      "Other services",
      true,
    ]);
    act(() => details.querySelector("summary")!.click());
    expect([details.open, rc.getValue(data.fields.expanded)]).toEqual([false, false]);
  });

  it("reports an adornment nothing handles", () => {
    const { warnings } = h.load(
      [{ type: "Data", field: "a", adornments: [{ type: "Spotlight", index: 1 }] }],
      [str("a")],
      { a: "" },
    );
    expect(kinds(warnings)).toEqual(["adornment"]);
  });

  it("asks a host adornment to amend props or wrap, and reports one that declines", () => {
    const { warnings } = h.load(
      [
        { type: "Data", field: "a", adornments: [{ type: "Spotlight" }] },
        { type: "Group", groupOptions: { type: "Standard" }, adornments: [{ type: "Spotlight" }], children: [] },
      ],
      [str("a")],
      { a: "" },
      {
        adornments: {
          Spotlight: {
            wrap: (_a, node, def) =>
              def.type === "Data" ? <div className="spotlit">{node}</div> : undefined,
          },
        },
      },
    );
    expect($(".spotlit input")).not.toBeNull();
    expect(warnings.map((w) => w.detail)).toEqual([
      'the host\'s "Spotlight" adornment declined this control — it is dropped',
    ]);
  });
});

describe("host translators", () => {
  it("are asked before the defaults, and get the props the loader built", () => {
    const switchTranslator: Translator = {
      match: (d) =>
        d.type === "Data" && (d as { renderOptions?: { type?: string } }).renderOptions?.type === "Switch",
      renderTypes: ["Switch"],
      render: ({ props }) => <TextField {...props} className="host-switch" />,
    };
    const { warnings } = h.load(
      [{ type: "Data", field: "a", renderOptions: { type: "Switch" } }],
      [str("a")],
      { a: "" },
      { translators: [switchTranslator, ...defaultTranslators] },
    );
    expect(warnings).toEqual([]);
    expect($$(".host-switch").length).toBe(1);
  });
});

describe("the audit", () => {
  it("reports a render type it fell back from, a property nothing read, and a missing schema field", () => {
    const { warnings } = h.load(
      [
        { type: "Data", field: "a", renderOptions: { type: "Stars" } },
        { type: "Data", field: "b", mystery: "value" },
        { type: "Data", field: "nope" },
        { type: "Data", field: "../../far" },
      ],
      [str("a"), str("b")],
      { a: "", b: "" },
    );
    expect(kinds(warnings)).toEqual(["renderOptions", "unread", "schema", "schema"]);
    expect(warnings[1].detail).toContain('"mystery"');
  });

  it("reports a prop the translator was handed and never passed on", () => {
    const dropping: Translator = {
      match: (d) => d.type === "Group",
      render: ({ children }) => <Contents>{children}</Contents>,
    };
    const { warnings } = h.load(
      [{ type: "Group", title: "T", layoutClass: "shell", children: [] }],
      [],
      {},
      { translators: [dropping, ...defaultTranslators] },
    );
    expect(warnings.map((w) => w.detail)).toEqual([
      '"title" was built into the "label" prop, which the translator never read — dropped',
      '"layoutClass" was built into the "shellClassName" prop, which the translator never read — dropped',
    ]);
  });

  it("throws LoaderStrictError under strict, carrying every warning", () => {
    const run = () =>
      translateForm(
        h.ctx,
        h.ctx.newControl({}),
        [],
        [{ type: "Data", field: "nope" } as never],
        { strict: true },
      );
    expect(run).toThrow(LoaderStrictError);
    try {
      run();
    } catch (e) {
      expect((e as LoaderStrictError).warnings).toHaveLength(1);
    }
    // And a clean translation does not throw.
    expect(() => translateForm(h.ctx, h.ctx.newControl({}), [], [], { strict: true })).not.toThrow();
  });
});

describe("a render that allocates once", () => {
  it("does not re-evaluate jsonata when the form re-renders", async () => {
    const { data } = h.load(
      [{ type: "Data", field: "a", dynamic: [{ type: "Visible", expr: { type: "Jsonata", expression: "b" } }] }],
      [str("a"), { field: "b", type: "Bool" }],
      { a: "", b: true },
    );
    await flush();
    const spy = vi.fn();
    const sub = data.subscribe(spy, 1);
    await flush();
    data.unsubscribe(sub);
    expect(spy).not.toHaveBeenCalled();
    expect(h.console).toEqual([]);
  });
});
