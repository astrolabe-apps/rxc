import { describe, expect, it } from "vitest";
import { dateModeOf, formatDateValue, fromBrowserDateValue, toBrowserDateValue } from "../src/index";

describe("picked values", () => {
  it("knows the three picked input types, and nothing else", () => {
    expect(["date", "datetime", "time", "text", undefined].map(dateModeOf)).toEqual(["date", "datetime", "time", undefined, undefined]);
  });

  it("round-trips through the browser's inputs in legacy's forms", () => {
    // A time of day keeps its seconds; a date is as it is.
    expect(toBrowserDateValue("time", "10:30:00")).toBe("10:30");
    expect(fromBrowserDateValue("time", "11:45")).toBe("11:45:00");
    expect(toBrowserDateValue("date", "2024-03-05")).toBe("2024-03-05");
    // An instant goes to local time and back to the same instant.
    const instant = "2024-03-05T00:30:00.000Z";
    expect(fromBrowserDateValue("datetime", toBrowserDateValue("datetime", instant))).toBe(instant);
    expect([toBrowserDateValue("datetime", "nonsense"), fromBrowserDateValue("date", "")]).toEqual(["", ""]);
  });

  it("shows a value as legacy's picker did", () => {
    const local = new Date("2024-03-05T00:30:00.000Z");
    const hh = String(local.getHours()).padStart(2, "0");
    expect([formatDateValue("date", "2024-03-05"), formatDateValue("time", "10:30:00"), formatDateValue("datetime", "2024-03-05T00:30:00.000Z")]).toEqual([
      "05/03/2024",
      "10:30",
      `${String(local.getDate()).padStart(2, "0")}/03/2024, ${hh}:30`,
    ]);
  });
});
