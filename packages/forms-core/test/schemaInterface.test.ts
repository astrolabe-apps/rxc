import { describe, expect, it } from "vitest";
import { DefaultSchemaInterface } from "../src/schemaInterface";
import { FieldType, type SchemaField } from "../src/json";

const si = new DefaultSchemaInterface();

function field(type: FieldType, extra: Partial<SchemaField> = {}): SchemaField {
  return { type, field: "f", ...extra } as SchemaField;
}

describe("textValue", () => {
  it("resolves option names before formatting", () => {
    const f = field(FieldType.String, {
      options: [{ name: "Apple", value: "a" }],
    });
    expect(si.textValue(f, "a")).toBe("Apple");
    expect(si.textValue(f, "b")).toBe("b");
  });

  it("formats booleans as Yes/No", () => {
    const f = field(FieldType.Bool);
    expect(si.textValue(f, true)).toBe("Yes");
    expect(si.textValue(f, false)).toBe("No");
    expect(si.textValue(f, null)).toBeUndefined();
  });

  describe("collection fields", () => {
    const f = field(FieldType.String, {
      collection: true,
      options: [
        { name: "Apple", value: "a" },
        { name: "Banana", value: "b" },
      ],
    });

    it("joins the formatted elements", () => {
      expect(si.textValue(f, ["a", "b"])).toBe("Apple, Banana");
      expect(si.textValue(f, ["a", "x"])).toBe("Apple, x");
    });

    it("drops empty elements from the join", () => {
      expect(si.textValue(f, ["a", null, "b"])).toBe("Apple, Banana");
    });

    it("returns undefined for a non-array value", () => {
      expect(si.textValue(f, null)).toBeUndefined();
      expect(si.textValue(f, "a")).toBeUndefined();
    });

    it("element: true formats a single element", () => {
      expect(si.textValue(f, "a", true)).toBe("Apple");
    });

    it("honours a custom separator", () => {
      const custom = new DefaultSchemaInterface(" | ");
      expect(custom.textValue(f, ["a", "b"])).toBe("Apple | Banana");
    });

    it("passed-in options override the field's", () => {
      expect(
        si.textValue(f, ["a"], undefined, [{ name: "Ace", value: "a" }]),
      ).toBe("Ace");
    });
  });
});
