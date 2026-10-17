import { inflateSync } from "node:zlib";
import { label, type ScreenNode } from "./target.js";

/**
 * A decoded picture: its size and each pixel's colour.
 *
 * @group Comparing
 */
export interface Picture {
  /** In px. */
  width: number;
  /** In px. */
  height: number;
  /** The colour at a pixel, `[r, g, b]`; black outside the picture. */
  pixel(x: number, y: number): [number, number, number];
}

/**
 * A PNG, decoded: 8-bit greyscale, RGB or RGBA, not interlaced — what a device's `screencap`
 * writes. No dependency: the image data is zlib, which Node inflates.
 *
 * @group Comparing
 */
export function decodePng(bytes: Uint8Array): Picture {
  const buf = Buffer.from(bytes);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("ascii", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8]!;
      const colour = body[9]!;
      if (depth !== 8 || body[12] !== 0) throw new Error("only 8-bit, non-interlaced PNGs are read");
      channels = colour === 6 ? 4 : colour === 2 ? 3 : colour === 0 ? 1 : colour === 4 ? 2 : 0;
      if (!channels) throw new Error(`PNG colour type ${colour} is not read`);
    } else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = new Uint8Array(stride * height);
  // Undo each row's filter (PNG's five: none, sub, up, average, Paeth).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[row + i - channels]! : 0;
      const b = y > 0 ? out[row - stride + i]! : 0;
      const c = y > 0 && i >= channels ? out[row - stride + i - channels]! : 0;
      const x = raw[src + i]!;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      out[row + i] = v & 0xff;
    }
  }
  return {
    width,
    height,
    pixel(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0];
      const i = y * stride + x * channels;
      return channels >= 3 ? [out[i]!, out[i + 1]!, out[i + 2]!] : [out[i]!, out[i]!, out[i]!];
    },
  };
}

const distance = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** What a piece of text looks like where it is drawn: its ink's box and colour. */
interface Ink {
  left: number;
  top: number;
  width: number;
  height: number;
  colour: [number, number, number];
}

/**
 * The ink of the text inside a box: the pixels that stand apart from the box's background (its
 * edge's commonest colour), their bounds, and the colour of the strongest of them.
 */
function inkOf(p: Picture, n: ScreenNode): Ink | undefined {
  const x0 = Math.max(0, n.x);
  const y0 = Math.max(0, n.y);
  const x1 = Math.min(p.width, n.x + n.w);
  const y1 = Math.min(p.height, n.y + n.h);
  if (x1 - x0 < 2 || y1 - y0 < 2) return undefined;
  const counts = new Map<string, { c: [number, number, number]; n: number }>();
  const edge = (x: number, y: number) => {
    const c = p.pixel(x, y);
    const k = c.map((v) => v >> 3).join(",");
    const e = counts.get(k) ?? { c, n: 0 };
    e.n++;
    counts.set(k, e);
  };
  for (let x = x0; x < x1; x++) (edge(x, y0), edge(x, y1 - 1));
  for (let y = y0; y < y1; y++) (edge(x0, y), edge(x1 - 1, y));
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0]!.c;
  let left = Infinity;
  let top = Infinity;
  let right = -1;
  let bottom = -1;
  let strongest = 0;
  const strong: [number, number, number][] = [];
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const c = p.pixel(x, y);
      const d = distance(c, bg);
      if (d < 80) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (d > strongest) strongest = d;
      strong.push(c);
    }
  if (right < 0) return undefined;
  // The colour: the mean of the ink well clear of the antialiased edge.
  const core = strong.filter((c) => distance(c, bg) >= strongest * 0.8);
  const mean = [0, 1, 2].map((i) => Math.round(core.reduce((s, c) => s + c[i]!, 0) / core.length)) as [number, number, number];
  return { left, top, width: right - left + 1, height: bottom - top + 1, colour: mean };
}

/**
 * The words on a screen as elements to compare: a merged element's words once, at the innermost
 * element carrying them, in reading order. Icon glyphs and the empty are left out.
 */
function wordsOf(nodes: ScreenNode[]): { words: string; node: ScreenNode }[] {
  const words = (n: ScreenNode) => label(n).replace(/[-￼]/g, "").replace(/^[\s,]+/, "").trim();
  const shown = nodes.filter((n) => n.w > 0 && n.h > 0 && words(n));
  // Innermost: no other element with the same words inside it.
  const inner = shown.filter(
    (n) =>
      !shown.some(
        (m) => m !== n && words(m) === words(n) && m.x >= n.x && m.y >= n.y && m.x + m.w <= n.x + n.w && m.y + m.h <= n.y + n.h && m.w * m.h < n.w * n.h,
      ),
  );
  inner.sort((a, b) => a.y - b.y || a.x - b.x);
  return inner.map((node) => ({ words: words(node), node }));
}

/**
 * The two screens' words paired in order: their longest common subsequence, so a piece of text
 * one screen has and the other lacks (an empty field's label, exposed on one) shifts no pairing.
 */
function align<T extends { words: string }>(a: T[], b: T[]): [T, T][] {
  const n = a.length;
  const m = b.length;
  const len = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      len[i]![j] = a[i]!.words === b[j]!.words ? len[i + 1]![j + 1]! + 1 : Math.max(len[i + 1]![j]!, len[i]![j + 1]!);
  const out: [T, T][] = [];
  for (let i = 0, j = 0; i < n && j < m; )
    if (a[i]!.words === b[j]!.words) out.push([a[i++]!, b[j++]!]);
    else if (len[i + 1]![j]! >= len[i]![j + 1]!) i++;
    else j++;
  return out;
}

/** Whether an element draws its words itself (a text, not a container named by them), big enough to measure. */
const drawsText = (n: ScreenNode) => !!n.text.trim() && n.w >= 8 && n.h >= 8;

/**
 * One way two screens differ, for one piece of text: the space above it (from the text before),
 * its size or left edge as drawn, or its colour.
 *
 * @group Comparing
 */
export interface LayoutDifference {
  /** What differs: the space above the text, its size or left edge as drawn, its colour. */
  kind: "gap" | "size" | "left" | "colour";
  /** The words it is about. */
  words: string;
  /** On the first screen: px, `w×h`, or a colour. */
  first: string;
  /** On the second screen. */
  second: string;
  /** How far apart, in px (a colour's distance for `colour`): what a step's score adds up. */
  delta: number;
}

/**
 * How far off two screens may be before it counts: px for gaps and edges, and for sizes a
 * fraction of the size as well. Defaults to what is visible on a phone: 8px, 6px, 8%, a colour 60 apart.
 *
 * @group Comparing
 */
export interface LayoutTolerance {
  /** The space above a piece of text, px. Default 8. */
  gap?: number;
  /** Its left edge, px. Default 6. */
  left?: number;
  /** Its size, px — and also more than {@link sizeFraction} of it. Default 6. */
  size?: number;
  /** Its size, as a fraction. Default 0.08. */
  sizeFraction?: number;
  /** Its colour, as RGB distance. Default 60. */
  colour?: number;
}

const hex = (c: number[]) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/**
 * Where two screens of one step lay their words out differently: each piece of text both show,
 * paired in order by their words (a longest common subsequence), compared for the space above it, its size and left
 * edge as drawn, and its colour — the last three from the pictures, when given. Words only one
 * screen shows are the step-by-step comparison's to report ({@link compareRuns}), not this.
 *
 * @group Comparing
 */
export function compareLayouts(
  first: { nodes: ScreenNode[]; picture?: Picture },
  second: { nodes: ScreenNode[]; picture?: Picture },
  tolerance: LayoutTolerance = {},
): LayoutDifference[] {
  const t = { gap: 8, left: 6, size: 6, sizeFraction: 0.08, colour: 60, ...tolerance };
  // A piece of text cut off at a scroll edge on one screen has bounds less than half the other's:
  // nothing about it can be compared, so it is left out.
  const pairs = align(wordsOf(first.nodes), wordsOf(second.nodes))
    .map(([a, b]) => ({ a, b }))
    .filter(({ a, b }) => Math.min(a.node.h, b.node.h) >= Math.max(a.node.h, b.node.h) / 2);
  const out: LayoutDifference[] = [];
  // Each piece of text where it is drawn — its ink — when the pictures have it, else its element.
  const placed = pairs.map((p) => {
    const measured = drawsText(p.a.node) && drawsText(p.b.node);
    const ia = measured && first.picture ? inkOf(first.picture, p.a.node) : undefined;
    const ib = measured && second.picture ? inkOf(second.picture, p.b.node) : undefined;
    return { ...p, ia, ib };
  });
  // Where a piece of text starts, compared like with like: both inks, or both elements. An input
  // is a box on one platform and the text inside a frame on another; the words are where they are.
  const tops = (p: (typeof placed)[number], q: (typeof placed)[number]) =>
    p.ia && p.ib && q.ia && q.ib
      ? [p.ia.top - q.ia.top, p.ib.top - q.ib.top]
      : [p.a.node.y - q.a.node.y, p.b.node.y - q.b.node.y];
  placed.forEach((p, i) => {
    const prev = placed[i - 1];
    if (prev) {
      const [ga, gb] = tops(p, prev);
      if (Math.abs(ga! - gb!) > t.gap)
        out.push({ kind: "gap", words: p.a.words, first: `${ga}px`, second: `${gb}px`, delta: Math.abs(ga! - gb!) });
    }
    const { ia, ib } = p;
    if (!ia || !ib) return;
    const dw = Math.abs(ia.width - ib.width);
    const dh = Math.abs(ia.height - ib.height);
    const off = (d: number, size: number) => d > t.size && d > size * t.sizeFraction;
    if (off(dw, Math.max(ia.width, ib.width)) || off(dh, Math.max(ia.height, ib.height)))
      out.push({ kind: "size", words: p.a.words, first: `${ia.width}×${ia.height}`, second: `${ib.width}×${ib.height}`, delta: Math.max(dw, dh) });
    const dl = Math.abs(ia.left - ib.left);
    if (dl > t.left) out.push({ kind: "left", words: p.a.words, first: `${ia.left}px`, second: `${ib.left}px`, delta: dl });
    const dc = distance(ia.colour, ib.colour);
    if (dc > t.colour)
      out.push({ kind: "colour", words: p.a.words, first: hex(ia.colour), second: hex(ib.colour), delta: Math.round(dc) });
  });
  return out;
}
