import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCompatPatchInfo, setStrictAmbient } from "@react-typed-forms/core";
import { CompatApp } from "../src/app/v2/compat/CompatFixture";

// React 19 warns unless this is set for `act()`.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

/**
 * The HVAMS gate (FORMS-V2-PLAN phase 2): Forms v2 inside a compat-engine
 * app. Strict ambient mode throws on any uncollected ambient read and on any
 * read through a finalized `rc`, so staleness fails the test instead of
 * passing silently; any console error or warning fails it too.
 */
beforeAll(() => setStrictAmbient("throw"));
afterAll(() => setStrictAmbient("off"));

let root: Root;
let container: HTMLDivElement;
let messages: string[];
beforeEach(() => {
  messages = [];
  for (const level of ["error", "warn"] as const)
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      messages.push(`console.${level}: ${args.map(String).join(" ")}`);
    });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<CompatApp />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  expect(messages).toEqual([]);
});

const $ = <E extends Element = HTMLElement>(sel: string) =>
  container.querySelector(sel) as E;
const text = (sel: string) => $(sel).textContent;
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const click = (sel: string) => act(() => $<HTMLButtonElement>(sel).click());
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

describe("Forms v2 in a compat-engine app", () => {
  it("runs on one engine copy", () => {
    expect(getCompatPatchInfo()).toMatchObject({
      packageCopies: 1,
      engineCopies: 1,
    });
  });

  it("re-renders legacy ambient readers when v2 writes", () => {
    type($("#v2-name"), "Ada");
    expect(text("[data-legacy-name]")).toBe("Ada");
    expect($<HTMLInputElement>("[data-legacy-input]").value).toBe("Ada");
  });

  it("re-renders v2 when the legacy side writes: Finput, a mutator, an array op", () => {
    type($("[data-legacy-input]"), "Grace");
    expect($<HTMLInputElement>("#v2-name").value).toBe("Grace");

    click("[data-legacy-set-status]");
    expect($<HTMLSelectElement>("#v2-status").value).toBe("inactive");

    click("[data-legacy-add-pet]");
    const pets = [...container.querySelectorAll<HTMLInputElement>("[data-v2] input")]
      .map((i) => i.value)
      .filter((v) => v === "Rex" || v === "Tiddles");
    expect(pets).toEqual(["Rex", "Tiddles"]);
  });

  it("reports v2 array writes to the legacy side", () => {
    const add = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Add pet (v2)",
    )!;
    act(() => add.click());
    expect(text("[data-legacy-pets]")).toBe("2");
  });

  it("publishes v2 validation where legacy code reads it", async () => {
    expect(text("[data-v2-status]")).toContain("invalid");
    expect(text("[data-legacy-name-error]")).toBe("Please enter a value");
    const check = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Check form",
    )!;
    act(() => check.click());
    await flush();
    // The check touched the form, so the error now shows in the v2 field.
    expect($("[data-v2]").textContent).toContain("Please enter a value");
    type($("[data-legacy-input]"), "Ada");
    expect(text("[data-v2-status]")).toContain("valid");
    expect(text("[data-v2-status]")).not.toContain("invalid");
    expect(text("[data-legacy-name-error]")).toBe("—");
  });
});
