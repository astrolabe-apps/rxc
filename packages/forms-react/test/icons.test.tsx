import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import {
  chromeGlyph,
  FormIconsProvider,
  isIconRef,
  useDrawIcon,
  type IconDrawArgs,
  type IconSet,
  type IconSpec,
} from "../src/index";
import { setupDom } from "./harness";

const dom = setupDom();

const glyphSet: IconSet = (i) => {
  const g = chromeGlyph(i);
  return g ? <span data-set="default">{g}</span> : null;
};

function Draw({ icon, size, color }: { icon: IconSpec; size?: number; color?: string }) {
  const draw = useDrawIcon();
  return <>{draw(icon, glyphSet, { size, color })}</>;
}

describe("icons", () => {
  it("tells a name from a node", () => {
    expect(isIconRef({ name: "check" })).toBe(true);
    expect(isIconRef({ family: "fa-regular", name: "chevron-right" })).toBe(true);
    expect(isIconRef("check")).toBe(false);
    expect(isIconRef(<i />)).toBe(false);
    expect(isIconRef(null)).toBe(false);
    expect(isIconRef(["a", "b"])).toBe(false);
  });

  it("draws a chrome name from the default set, nothing for another name or family", () => {
    expect(chromeGlyph({ name: "check" })).toBe("✓");
    expect(chromeGlyph({ name: "check", family: "fa-solid" })).toBeUndefined();
    expect(chromeGlyph({ name: "toString" })).toBeUndefined();
    dom.mount(
      <>
        <Draw icon={{ name: "info" }} />
        <Draw icon={{ name: "house-building", family: "fa-regular" }} />
      </>,
    );
    expect(dom.container.innerHTML).toBe('<span data-set="default">ⓘ</span>');
  });

  it("places a node as it is, a string as words", () => {
    dom.mount(
      <>
        <Draw icon="@" />
        <Draw icon={<b>x</b>} />
      </>,
    );
    expect(dom.container.innerHTML).toBe("@<b>x</b>");
  });

  it("asks the innermost set first, falling through on undefined to the default", () => {
    const asked: IconDrawArgs[] = [];
    const outer: IconSet = (i) => {
      asked.push(i);
      return i.family === "fa-regular" ? <i data-set="outer" data-name={i.name} /> : undefined;
    };
    const inner: IconSet = (i) => (i.name === "star" ? <i data-set="inner" /> : undefined);
    const ui = (icon: IconSpec, size?: number, color?: string): ReactNode => (
      <FormIconsProvider set={outer}>
        <FormIconsProvider set={inner}>
          <Draw icon={icon} size={size} color={color} />
        </FormIconsProvider>
      </FormIconsProvider>
    );
    dom.mount(ui({ name: "star", family: "fa-regular" }));
    expect(dom.container.innerHTML).toBe('<i data-set="inner"></i>');
    expect(asked).toEqual([]);

    dom.mount(ui({ name: "phone", family: "fa-regular" }, 18, "#123"));
    expect(dom.container.innerHTML).toBe('<i data-set="outer" data-name="phone"></i>');
    expect(asked).toEqual([{ name: "phone", family: "fa-regular", size: 18, color: "#123" }]);

    dom.mount(ui({ name: "check" }));
    expect(dom.container.innerHTML).toBe('<span data-set="default">✓</span>');
  });

  it("draws nothing when a set says null, without asking further", () => {
    const none: IconSet = () => null;
    dom.mount(
      <FormIconsProvider set={none}>
        <Draw icon={{ name: "check" }} />
      </FormIconsProvider>,
    );
    expect(dom.container.innerHTML).toBe("");
  });
});
