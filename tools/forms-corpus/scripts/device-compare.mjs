// Draws corpus forms on the Android emulator through the real ServiceTas legacy renderers
// (the servicetas-rn harness, Metro on 8083) and through forms-native (apps/native-dev,
// Metro on 8082), and diffs what each put on screen, from `uiautomator dump`.
//
//   node scripts/device-compare.mjs [--out dir] [Form ...]
//
// Both apps must be running (see each README) with the same forms synced. The window is made
// tall (`wm size`) so a form is one screen, and reset afterwards. Output: per form, a
// screenshot and a json of the visible text elements from each side, and `report.md`.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const oi = argv.indexOf("--out");
const out = oi >= 0 ? argv.splice(oi, 2)[1] : "corpus/compare";
const wanted = argv;
const ADB = process.env.ADB ?? join(process.env.HOME, "Android/Sdk/platform-tools/adb");
const adb = (...a) => execFileSync(ADB, a, { maxBuffer: 1 << 28 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dump = () => {
  adb("shell", "uiautomator", "dump", "/sdcard/ui.xml");
  return adb("shell", "cat", "/sdcard/ui.xml").toString();
};
const nodes = (xml) =>
  [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map((m) => {
    const g = (k) => (m[1].match(new RegExp(` ${k}="([^"]*)"`)) || [])[1] ?? "";
    const b = g("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/).slice(1).map(Number);
    return {
      text: g("text").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      desc: g("content-desc"),
      cls: g("class"),
      clickable: g("clickable") === "true",
      enabled: g("enabled") === "true",
      x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1],
    };
  });
const find = (t) => nodes(dump()).find((n) => n.text === t || n.desc === t);
const tap = (n, dx = 0) => adb("shell", "input", "tap", String(n.x + (dx || n.w >> 1)), String(n.y + (n.h >> 1)));

async function waitFor(text, ms = 120000, swipeY) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const n = find(text);
    if (n) return n;
    if (swipeY) adb("shell", "input", "swipe", "900", String(swipeY), "150", String(swipeY), "200");
    await sleep(1500);
  }
  throw new Error(`never saw "${text}"`);
}

const apps = [
  { name: "legacy", port: 8083, start: async () => {}, chipsY: null },
  {
    name: "v2", port: 8082,
    // the playground opens on its first screen; the Converted screen is a chip in the top row
    start: async () => {
      // the dev-menu gear sits over the end of the row, so tap the chip's left part
      const c = await waitFor("Converted", 60000, 160);
      tap(c, 25);
      await sleep(2500);
    },
  },
];

const runApp = async (app, names) => {
  adb("reverse", `tcp:${app.port}`, `tcp:${app.port}`);
  adb("shell", "am", "force-stop", "host.exp.exponent");
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `exp://127.0.0.1:${app.port}`, "host.exp.exponent");
  await sleep(8000);
  await app.start();
  const result = {};
  for (const name of names) {
    const chip = await waitFor(name, 60000);
    // the dev-menu gear covers the right end of the screen: tap the chip's left part
    tap(chip, Math.min(chip.w >> 1, 40));
    await sleep(3000);
    const all = nodes(dump());
    const chipBottom = Math.max(...names.map((n) => all.find((x) => x.text === n)).filter(Boolean).map((n) => n.y + n.h));
    // what the form drew: everything under the form chips, with text or an accessible name
    const seen = new Set();
    const els = all.filter((n) => {
      const l = (n.text || n.desc).trim();
      if (n.y < chipBottom || !l || names.includes(n.text)) return false;
      // a text and its container often both carry the words, at the same place
      const k = `${l}|${n.x}|${n.y}|${n.w}|${n.h}`;
      return !seen.has(k) && seen.add(k);
    });
    result[name] = els;
    writeFileSync(join(out, `${name}.${app.name}.png`), adb("exec-out", "screencap", "-p"));
    writeFileSync(join(out, `${name}.${app.name}.json`), JSON.stringify(els, null, 1));
  }
  return result;
};

mkdirSync(out, { recursive: true });
const names = wanted.length ? wanted : ["AccountDetails"];
const size0 = adb("shell", "wm", "size").toString().match(/(\d+x\d+)/)[1];
const [w0] = size0.split("x");
adb("shell", "wm", "size", `${w0}x6000`);
let res;
try {
  res = {};
  for (const app of apps) res[app.name] = await runApp(app, names);
} finally {
  adb("shell", "wm", "size", "reset");
}

// ── the diff ─────────────────────────────────────────────────────────
const label = (n) => n.text || n.desc;
const tol = 6; // px at 2.625 px/dp is about 2dp
let md = `# Device comparison: legacy (servicetas-rn) vs forms-native\n\n`;
for (const name of names) {
  const a = res.legacy[name], b = res.v2[name];
  md += `## ${name}\n\n![legacy](${name}.legacy.png) ![v2](${name}.v2.png)\n\n`;
  // match by text in order (each v2 element to the next unmatched legacy one with the same text)
  const used = new Set();
  const pairs = [];
  const extraV2 = [];
  for (const y of b) {
    const i = a.findIndex((x, j) => !used.has(j) && label(x) === label(y));
    if (i < 0) extraV2.push(y);
    else { used.add(i); pairs.push([a[i], y]); }
  }
  const missingV2 = a.filter((_, j) => !used.has(j));
  const lines = [];
  if (pairs.length) {
    // positions relative to the first matched element on each side; flag where a gap grows
    const [a0, b0] = pairs[0];
    let prev = 0;
    for (const [x, y] of pairs) {
      const dy = (y.y - b0.y) - (x.y - a0.y);
      const dx = (y.x - b0.x) - (x.x - a0.x);
      const dw = y.w - x.w, dh = y.h - x.h;
      const flags = [];
      if (Math.abs(dy - prev) > tol) flags.push(`gap ${dy - prev > 0 ? "+" : ""}${dy - prev}px above`);
      if (Math.abs(dx) > tol) flags.push(`x ${dx > 0 ? "+" : ""}${dx}`);
      // a text's width is its words' unless something stretches it; a control's size is its own
      const sized = x.clickable || y.clickable || /EditText/.test(x.cls + y.cls);
      if (sized && Math.abs(dw) > tol) flags.push(`w ${dw > 0 ? "+" : ""}${dw}`);
      if (sized && Math.abs(dh) > tol) flags.push(`h ${dh > 0 ? "+" : ""}${dh}`);
      if (x.enabled !== y.enabled) flags.push(`enabled ${x.enabled}→${y.enabled}`);
      if (x.clickable !== y.clickable) flags.push(`clickable ${x.clickable}→${y.clickable}`);
      if (flags.length) lines.push(`- "${label(x).slice(0, 60)}": ${flags.join(", ")}`);
      prev = dy;
    }
  }
  md += `${pairs.length} elements matched by text; legacy-only ${missingV2.length}, v2-only ${extraV2.length}.\n\n`;
  if (missingV2.length) md += `Only in legacy:\n${missingV2.map((x) => `- "${label(x).slice(0, 80)}"`).join("\n")}\n\n`;
  if (extraV2.length) md += `Only in v2:\n${extraV2.map((x) => `- "${label(x).slice(0, 80)}"`).join("\n")}\n\n`;
  md += lines.length ? `Differences (px; "gap" is space added or lost above the element):\n${lines.join("\n")}\n\n` : `No layout differences over ${tol}px.\n\n`;
}
writeFileSync(join(out, "report.md"), md);
console.log(md);
