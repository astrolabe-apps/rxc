import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compareLayouts, decodePng, type ScreenNode } from "../src/index.js";

const node = (o: Partial<ScreenNode>): ScreenNode => ({
  text: "",
  desc: "",
  cls: "android.widget.TextView",
  id: "",
  clickable: false,
  checkable: false,
  checked: false,
  enabled: true,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  ...o,
});

/** A white picture with solid boxes drawn on it, as a device's PNG (RGBA, filtered by row). */
function png(width: number, height: number, boxes: { x: number; y: number; w: number; h: number; c: number[] }[]): Uint8Array {
  const rows = Buffer.alloc((width * 4 + 1) * height, 0xff);
  for (let y = 0; y < height; y++) rows[y * (width * 4 + 1)] = y % 2 ? 2 : 0; // "up" and "none" filters
  const at = (x: number, y: number) => y * (width * 4 + 1) + 1 + x * 4;
  const px = Array.from({ length: height }, () => Array.from({ length: width }, () => [255, 255, 255, 255]));
  for (const b of boxes) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) px[y]![x] = [...b.c, 255];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let i = 0; i < 4; i++) {
        const v = px[y]![x]![i]!;
        rows[at(x, y) + i] = y % 2 ? (v - px[y - 1]![x]![i]! + 256) & 0xff : v;
      }
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("decodePng", () => {
  it("reads a device's RGBA picture, its rows' filters undone", () => {
    const p = decodePng(png(6, 4, [{ x: 2, y: 1, w: 2, h: 2, c: [38, 113, 81] }]));
    expect([p.width, p.height, p.pixel(0, 0), p.pixel(2, 1), p.pixel(3, 2), p.pixel(5, 3)]).toEqual([
      6, 4, [255, 255, 255], [38, 113, 81], [38, 113, 81], [255, 255, 255],
    ]);
  });
});

describe("compareLayouts", () => {
  const heading = (y: number) => node({ text: "Address", x: 0, y, w: 60, h: 20 });
  const field = (y: number) => node({ text: "Postal address", x: 0, y, w: 60, h: 20 });

  it("finds the space above a piece of text grown, matching the words and not the element", () => {
    const d = compareLayouts({ nodes: [heading(10), field(40)] }, { nodes: [heading(110), field(160)] });
    expect(d).toEqual([{ kind: "gap", words: "Postal address", first: "30px", second: "50px", delta: 20 }]);
    // Within tolerance, nothing; words only one screen shows are not this comparison's.
    expect(compareLayouts({ nodes: [heading(10), field(40)] }, { nodes: [heading(10), field(45), node({ text: "Extra", y: 80, w: 9, h: 9 })] })).toEqual([]);
  });

  it("measures text as drawn — its ink's size, left edge and colour — from the pictures", () => {
    const at = { nodes: [node({ text: "Link", x: 0, y: 0, w: 40, h: 20 })] };
    const ink = (x: number, w: number, c: number[]) => decodePng(png(40, 20, [{ x, y: 4, w, h: 12, c }]));
    const d = compareLayouts({ ...at, picture: ink(2, 20, [38, 113, 81]) }, { ...at, picture: ink(12, 28, [52, 53, 52]) });
    expect(d.map((x) => [x.kind, x.first, x.second])).toEqual([
      ["size", "20×12", "28×12"],
      ["left", "2px", "12px"],
      ["colour", "#267151", "#343534"],
    ]);
  });
});
