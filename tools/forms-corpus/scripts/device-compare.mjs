// Draws corpus forms on the Android emulator through the real ServiceTas legacy renderers
// (the servicetas-rn harness, Metro on 8083) and through forms-native (apps/native-dev,
// Metro on 8082), and diffs what each put on screen, from `uiautomator dump`.
//
//   node scripts/device-compare.mjs [--out dir] [Form ...]
//
// Both apps must be running (see each README), the playground with the forms synced. The window is made
// tall (`wm size`) so a form is one screen, and reset afterwards. Output: per form, a
// screenshot and a json of the visible text elements from each side, and `report.md`.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { androidTarget } from "@rx-controls/forms-scenarios";

const argv = process.argv.slice(2);
const oi = argv.indexOf("--out");
const out = oi >= 0 ? argv.splice(oi, 2)[1] : "corpus/compare";
const wanted = argv;
const ADB = process.env.ADB ?? join(process.env.HOME, "Android/Sdk/platform-tools/adb");
const adb = (...a) => execFileSync(ADB, a, { maxBuffer: 1 << 28 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each app is a form-scenario target (@rx-controls/forms-scenarios): a link opens the form, and
// the screen read is the form's own container, nothing of the app around it.
const apps = [
  { name: "legacy", url: "exp://127.0.0.1:8083" },
  { name: "v2", url: "exp://127.0.0.1:8082" },
];

const runApp = async (app, names) => {
  adb("reverse", `tcp:${app.url.split(":").pop()}`, `tcp:${app.url.split(":").pop()}`);
  // The window is made tall here, once for both apps, so tallHeight 0.
  const target = androidTarget({ name: app.name, url: app.url, tallHeight: 0 });
  const result = {};
  for (const name of names) {
    await target.open(name, {});
    const seen = new Set();
    // what the form drew, with text or an accessible name; a text and its container often
    // both carry the words, at the same place
    const els = (await target.screen()).filter((n) => {
      const l = (n.text || n.desc).trim();
      if (!l) return false;
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
