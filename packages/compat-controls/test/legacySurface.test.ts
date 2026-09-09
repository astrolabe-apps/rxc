import { describe, expect, it } from "vitest";
import { ControlChange } from "../src/index";

/**
 * `ControlChange` as `@react-typed-forms/core@4.6.0` published it — that
 * version re-exported the enum from `@astroapps/controls@1.4.2`, whose
 * declaration this copies verbatim.
 *
 * Legacy consumers subscribe with these names and persist these numbers, so
 * v5 must keep both. The reason this needs a test at all: compat currently
 * re-exports *core's* enum by object identity
 * (`packages/compat-controls/src/types.ts`), so any change to a member name
 * in `@rxc/controls-core` silently changes this package's published surface.
 * `All` is the live case — core is renaming it `AllState`, and because
 * nothing in this repo references `ControlChange.All`, tsc, lint and every
 * other test stay silent while it disappears from the legacy API.
 */
const LEGACY_MEMBERS = {
  None: 0,
  Valid: 1,
  Touched: 2,
  Dirty: 4,
  Disabled: 8,
  Value: 16,
  InitialValue: 32,
  Error: 64,
  All: 127,
  Structure: 128,
  Validate: 256,
} as const;

describe("legacy ControlChange surface", () => {
  it("keeps every v4 member at its v4 value", () => {
    const published = ControlChange as unknown as Record<string, number>;
    const actual: Record<string, number> = {};
    for (const name of Object.keys(LEGACY_MEMBERS)) {
      actual[name] = published[name];
    }
    expect(actual).toStrictEqual(LEGACY_MEMBERS);
  });

  it("keeps the numeric-enum reverse mapping", () => {
    // A TS numeric enum is bidirectional at runtime. Replacing it with a
    // plain const object would drop this half without any call site
    // noticing, so pin it — legacy code and devtools read it.
    const published = ControlChange as unknown as Record<number, string>;
    for (const [name, value] of Object.entries(LEGACY_MEMBERS)) {
      expect(published[value]).toBe(name);
    }
  });
});
