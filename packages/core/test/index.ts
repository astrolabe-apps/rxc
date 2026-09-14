import { ControlChange, ControlContext } from "../src/types";
import { createControlContext } from "../src/controlContextImpl";
import { expect } from "vitest";

export function expectChanges(
  changes: ControlChange[],
  expected: ControlChange[],
) {
  expect(changes).toStrictEqual(expected);
  changes.length = 0;
}

export function makeCtx(): ControlContext {
  return createControlContext();
}
