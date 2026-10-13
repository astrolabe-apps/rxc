import { describe, expect, it, vi } from "vitest";
import { NO_LOOK_STATE, type LookState } from "@rx-controls/forms-react";
import { tailwindToPart, tailwindToLook, tailwindPartCode } from "../src/convert/tailwind.js";

const at = (over: Partial<LookState>): LookState => ({ ...NO_LOOK_STATE, ...over });
const value = (classes: string, state: Partial<LookState> = {}) => {
  const p = tailwindToPart(classes);
  return typeof p === "function" ? p(at(state)) : p;
};

describe("tailwindToPart", () => {
  it("converts layout, spacing and the scale", () => {
    expect(value("flex flex-col gap-[16px] p-4 px-[5px] w-full items-center justify-between")).toEqual({
      display: "flex",
      flexDirection: "column",
      gap: 16,
      padding: 16,
      paddingHorizontal: 5,
      width: "100%",
      alignItems: "center",
      justifyContent: "space-between",
    });
    expect(value("gap-2 pl-4 mt-[1rem] -mt-2 w-1/2")).toMatchObject({
      gap: 8,
      paddingLeft: 16,
      marginTop: -8,
      width: "50%",
    });
  });

  it("keeps text size, colour and alignment apart, with colours as theme tokens", () => {
    expect(value("text-[24px] text-accent text-center text-danger/10 !text-[#6D4B21]")).toEqual({
      fontSize: 24,
      color: "#6D4B21",
      textAlign: "center",
    });
    expect(value("text-accent bg-danger/10 border border-surface-200 bg-white")).toEqual({
      color: "$accent",
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: "$surface-200",
    });
    expect(value("bg-[#6D4B211F] text-lg font-bold rounded-md")).toEqual({
      backgroundColor: "#6D4B211F",
      fontSize: 18,
      lineHeight: 28,
      fontWeight: "700",
      borderRadius: 6,
    });
  });

  it("applies native: and drops web:", () => {
    expect(value("native:pl-[8px] web:pt-[8px] p-0")).toEqual({ paddingLeft: 8, padding: 0 });
  });

  it("drops an icon font's classes, which name a glyph and no style", () => {
    const onUnknown = vi.fn();
    expect(tailwindToPart("fa fa-regular fa-circle-info text-[5px]", { onUnknown })).toEqual({ fontSize: 5 });
    expect(onUnknown).not.toHaveBeenCalled();
  });

  it("turns breakpoints and states into a function of the look's state", () => {
    const p = tailwindToPart("flex-col lg:flex-row active:bg-[#DDD] min-[540px]:gap-4");
    expect(typeof p).toBe("function");
    const f = p as (s: LookState) => object;
    expect(f(at({ width: 0 }))).toEqual({ flexDirection: "column" });
    expect(f(at({ width: 1024 }))).toEqual({ flexDirection: "row", gap: 16 });
    expect(f(at({ pressed: true }))).toEqual({ flexDirection: "column", backgroundColor: "#DDD" });
  });

  it("layers in the order written, and takes a host's own names", () => {
    expect(tailwindToPart("title1 text-center", { named: { title1: { fontSize: 28, textAlign: "left" } } })).toEqual({
      fontSize: 28,
      textAlign: "center",
    });
    expect(tailwindToPart("!title1", { named: { title1: { fontSize: 28 } } })).toEqual({ fontSize: 28 });
  });

  it("reports what it cannot convert, once per token, and leaves it out", () => {
    const onUnknown = vi.fn();
    const p = tailwindToPart("grid gap-[8px] [&>*]:w-full group-hover:text-white select-none group", { onUnknown });
    expect(p).toEqual({ gap: 8 });
    expect(onUnknown.mock.calls.map((c) => c[0])).toEqual(["grid", "[&>*]:w-full", "group-hover:text-white"]);
  });
});

describe("tailwindToLook", () => {
  it("converts every part, and a replace keeps its meaning", () => {
    const l = tailwindToLook({ shell: "p-2", control: { replace: "gap-1" } });
    expect(l.shell).toEqual({ padding: 8 });
    expect(l.control).toEqual({ replace: { gap: 4 } });
  });
});

describe("tailwindPartCode", () => {
  it("writes a plain style as an object and a state-dependent one as a function that agrees with tailwindToPart", () => {
    expect(tailwindPartCode("gap-[8px] p-4")).toBe('{"gap":8,"padding":16}');
    const classes = "flex-col lg:flex-row active:bg-[#DDD] max-[600px]:p-2";
    const code = tailwindPartCode(classes);
    const fn = new Function(`return ${code}`)() as (s: LookState) => object;
    const ref = tailwindToPart(classes) as (s: LookState) => object;
    for (const s of [at({}), at({ width: 1100 }), at({ pressed: true, width: 500 })])
      expect(fn(s)).toEqual(ref(s));
  });
});
