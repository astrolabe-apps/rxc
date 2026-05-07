import { describe, expect, it } from "vitest";
import { isValidElement, type ReactNode } from "react";
import type { FormStateNode } from "@rxc/forms-core";
import {
  indexAdornments,
  wrapAdornments,
  type AdornmentRegistration,
} from "../src/Adornment";

const fakeNode = {} as unknown as FormStateNode;

/**
 * Build a fake adornment "render" component whose function `name` is
 * the supplied label. We don't actually render — we walk the React
 * element tree returned by wrapAdornments and read each element's
 * `type.name` (or displayName) to recover the wrap order.
 */
function makeMarker(label: string) {
  const fn = ({ children }: { children: ReactNode }) => children as ReactNode;
  Object.defineProperty(fn, "name", { value: label });
  return fn;
}

function readMarkers(node: ReactNode): string[] {
  const out: string[] = [];
  let cur: unknown = node;
  while (isValidElement(cur)) {
    const el = cur as { type: unknown; props: { children?: unknown } };
    const t = el.type as { name?: string; displayName?: string };
    out.push(t.displayName ?? t.name ?? "anon");
    cur = el.props.children;
  }
  return out;
}

describe("wrapAdornments", () => {
  it("priority-asc + reduceRight gives [A=0, B=1, C=2] → C wraps B wraps A", () => {
    const regs: AdornmentRegistration[] = [
      { type: "A", kind: "control", priority: 0, render: makeMarker("A") },
      { type: "B", kind: "control", priority: 1, render: makeMarker("B") },
      { type: "C", kind: "control", priority: 2, render: makeMarker("C") },
    ];
    const map = indexAdornments(regs);
    const wrapped = wrapAdornments(
      [{ type: "A" }, { type: "B" }, { type: "C" }],
      map,
      "control",
      "TARGET" as unknown as ReactNode,
      fakeNode,
    );
    // Outermost first
    expect(readMarkers(wrapped)).toEqual(["C", "B", "A"]);
  });

  it("partitions by kind — only matching-kind adornments wrap", () => {
    const regs: AdornmentRegistration[] = [
      { type: "L1", kind: "label", render: makeMarker("L1") },
      { type: "C1", kind: "control", render: makeMarker("C1") },
      { type: "F1", kind: "field", render: makeMarker("F1") },
    ];
    const map = indexAdornments(regs);
    const adornments = [{ type: "L1" }, { type: "C1" }, { type: "F1" }];
    const target = "X" as unknown as ReactNode;
    expect(readMarkers(wrapAdornments(adornments, map, "label", target, fakeNode))).toEqual(["L1"]);
    expect(readMarkers(wrapAdornments(adornments, map, "control", target, fakeNode))).toEqual(["C1"]);
    expect(readMarkers(wrapAdornments(adornments, map, "field", target, fakeNode))).toEqual(["F1"]);
  });

  it("unregistered adornment types are silently dropped", () => {
    const regs: AdornmentRegistration[] = [
      { type: "Known", kind: "control", render: makeMarker("Known") },
    ];
    const map = indexAdornments(regs);
    const wrapped = wrapAdornments(
      [{ type: "Known" }, { type: "MysteryUnregistered" }],
      map,
      "control",
      "X" as unknown as ReactNode,
      fakeNode,
    );
    expect(readMarkers(wrapped)).toEqual(["Known"]);
  });

  it("empty adornment list returns the target unchanged", () => {
    const map = indexAdornments([]);
    const target = "X" as unknown as ReactNode;
    expect(wrapAdornments([], map, "control", target, fakeNode)).toBe(target);
  });

  it("indexAdornments — earlier registration shadows later for same type", () => {
    const first: AdornmentRegistration = {
      type: "Same",
      kind: "control",
      render: makeMarker("first"),
    };
    const second: AdornmentRegistration = {
      type: "Same",
      kind: "control",
      render: makeMarker("second"),
    };
    const map = indexAdornments([first, second]);
    expect(map.get("Same")).toBe(first);
  });
});
