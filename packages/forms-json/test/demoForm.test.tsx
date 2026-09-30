import { describe, expect, it } from "vitest";
import { createControlContext } from "@rx-controls/react";
import { translateForm } from "../src/index";
import { demoControls, demoSchema } from "../../../tools/forms-conformance/src/fixtures/demoForm";
import { flush, setupLoader } from "./harness";

/**
 * The fixture form end to end, with no host. It lives with the conformance
 * suite (`tools/forms-conformance`), which renders it under every
 * implementation; imported by path, since that package depends on this one. every gap it reports is one the
 * form contains on purpose — a host's render types, group kinds, adornments
 * and custom displays, action ids nobody claims, a `LayoutStyle` that is not
 * a toggle, a Textfield extension — so the list is pinned exactly. A gap that
 * appears is a translator that stopped reading something; one that
 * disappears is a warning that stopped firing.
 */
const h = setupLoader();

describe("the fixture form", () => {
  it("reports exactly the gaps it contains", () => {
    const ctx = createControlContext();
    const { warnings } = translateForm(ctx, ctx.newControl({}), demoSchema, demoControls);
    expect(warnings.map((w) => `${w.path} ${w.kind} ${w.subject}`)).toEqual([
      "6 unread status",
      "6 unread status",
      "8.3 action greet",
      "17 control Custom",
      "18 control Greeting",
      "19 renderOptions Push notifications",
      "20 renderOptions Heads up",
      "20 unread Heads up",
      "21 renderOptions Address (top-level)",
      "22 adornment Spotlit",
      "23 adornment Help on a group",
      "25 adornment Tooltipped field",
      "30 dynamic Bordered while Has pets — LayoutStyle, not a toggle",
      "31 unread Vet's phone (host keyboardType + autoComplete)",
      "31 unread Vet's phone (host keyboardType + autoComplete)",
      "32 dynamic Styled name",
      "33 action apply",
      "34 action greet",
      "35 action greet",
      "36 action launchRockets",
      "37 unread Notes dialog",
    ]);
  });

  it("renders through the html implementation with nothing on the console", async () => {
    h.load(demoControls, demoSchema, {
      firstName: "Ada",
      pets: [{ name: "Rex" }],
      address: { street: "", city: "" },
      status: "active",
      hasPets: true,
    });
    await flush();
    expect(h.container.textContent).toContain("Pet 1 of 1");
    expect(h.console).toEqual([]);
  });
});
