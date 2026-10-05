import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import {
  Contents,
  FormProvider,
  FormRenderers,
  InlineGroup,
  Section,
  combineClass,
  type GroupRenderProps,
  type FormRenderers as Renderers,
} from "../src";
import { setupDom } from "./harness";
import { testRenderers } from "./testRenderers";

const dom = setupDom();
const $$ = (sel: string) => [...dom.container.querySelectorAll(sel)];

function Kind(p: GroupRenderProps) {
  return <div data-kind={p.kind}>{p.children}</div>;
}

describe("group kind and FormRenderers", () => {
  it("tells a group renderer which group it draws", () => {
    dom.mount(
      <FormProvider renderers={{ ...testRenderers, contents: Kind, inline: Kind }}>
        <Contents>a</Contents>
        <Section title="S">b</Section>
        <InlineGroup>c</InlineGroup>
      </FormProvider>,
    );
    expect($$("[data-kind]").map((e) => e.getAttribute("data-kind"))).toEqual([
      "contents",
      "section",
      "inline",
    ]);
  });

  it("wraps the enclosing slot, for one part of the app, without mounting the root again", () => {
    let roots = 0;
    function Root({ children }: { children: ReactNode }) {
      roots++;
      return <div data-root>{children}</div>;
    }
    const bordered = (outer: Renderers): Partial<Renderers> => ({
      contents: (p: GroupRenderProps) => (
        <outer.contents
          {...p}
          className={
            p.kind === "section" ? combineClass(p.className, "border") : p.className
          }
        />
      ),
    });
    dom.mount(
      <FormProvider renderers={{ ...testRenderers, root: Root }}>
        <Section title="Outside">x</Section>
        <FormRenderers renderers={bordered}>
          <Section title="Inside">y</Section>
          <Contents>z</Contents>
        </FormRenderers>
      </FormProvider>,
    );
    const shell = (text: string) =>
      $$("[data-group]").find((e) => e.textContent?.includes(text))!.getAttribute("class");
    expect([shell("Outside"), shell("Inside"), shell("z")]).toEqual([null, "border", null]);
    expect([roots, $$("[data-root]").length]).toEqual([1, 1]);
  });

  it("nests, each level over the one above", () => {
    const tag = (name: string) => (outer: Renderers): Partial<Renderers> => ({
      contents: (p: GroupRenderProps) => (
        <outer.contents {...p} className={combineClass(p.className, name)} />
      ),
    });
    const a = tag("a");
    const b = tag("b");
    dom.mount(
      <FormProvider renderers={testRenderers}>
        <FormRenderers renderers={a}>
          <FormRenderers renderers={b}>
            <Contents>x</Contents>
          </FormRenderers>
        </FormRenderers>
      </FormProvider>,
    );
    // The inner override wraps the outer one, which wraps the implementation.
    expect($$("[data-group]")[0]!.getAttribute("class")).toBe("b a");
  });
});
