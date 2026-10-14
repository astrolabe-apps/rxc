import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPORT_PREFIX, withinForm, type Report, type ScreenNode, type Target } from "./target.js";

/**
 * Where an app runs on the device.
 *
 * @group Targets
 */
export interface AndroidTargetOptions {
  /** For reports: `legacy`, `v2`. */
  name: string;
  /** The app's base link: `exp://127.0.0.1:8083` for an app in Expo Go. */
  url: string;
  /** The Android package that opens it. Default Expo Go's, `host.exp.exponent`. */
  androidPackage?: string;
  /** `adb`. Default `$ADB`, else `~/Android/Sdk/platform-tools/adb`. */
  adb?: string;
  /**
   * Make the screen tall while a scenario runs (`wm size <width>x<height>`), so
   * a whole form is on screen without scrolling; reset by {@link Target.close}.
   * Default 6000. `0` leaves the screen as it is.
   */
  tallHeight?: number;
  /** How long to wait for a form to report it is drawn — a first bundle can take minutes. Default 180s. */
  openTimeout?: number;
  /** How long to let a form settle after an action. Default 800ms. */
  settle?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A target on an Android device or emulator through `adb`: the screen from
 * `uiautomator dump`, presses and typing through `input`, and the app's reports
 * from logcat (React Native logs `console.log` under `ReactNativeJS`).
 *
 * @group Targets
 */
export function androidTarget(o: AndroidTargetOptions): Target {
  const ADB = o.adb ?? process.env.ADB ?? join(process.env.HOME ?? "", "Android/Sdk/platform-tools/adb");
  const adb = (...a: string[]) => execFileSync(ADB, a, { maxBuffer: 1 << 28 }).toString();
  const settle = o.settle ?? 800;
  const tall = o.tallHeight ?? 6000;
  let run = "";
  let resized = false;

  const parse = (xml: string): ScreenNode[] =>
    [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map((m) => {
      const g = (k: string) => (m[1]!.match(new RegExp(` ${k}="([^"]*)"`)) ?? [])[1] ?? "";
      const b = (g("bounds").match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/) ?? []).slice(1).map(Number);
      const unescape = (s: string) =>
        s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      return {
        text: unescape(g("text")),
        desc: unescape(g("content-desc")),
        cls: g("class"),
        id: g("resource-id"),
        clickable: g("clickable") === "true",
        checkable: g("checkable") === "true",
        checked: g("checked") === "true",
        enabled: g("enabled") === "true",
        x: b[0] ?? 0,
        y: b[1] ?? 0,
        w: (b[2] ?? 0) - (b[0] ?? 0),
        h: (b[3] ?? 0) - (b[1] ?? 0),
      };
    });

  /** This run's report lines, parts reassembled. */
  const lines = (): Record<string, unknown>[] => {
    const raw = adb("logcat", "-d", "-v", "raw", "-s", "ReactNativeJS:*");
    const out: Record<string, unknown>[] = [];
    const parts: Record<number, string> = {};
    for (const l of raw.split("\n")) {
      const at = l.indexOf(REPORT_PREFIX);
      if (at < 0) continue;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(l.slice(at + REPORT_PREFIX.length));
      } catch {
        continue;
      }
      if (msg.run !== run) continue;
      if (msg.kind === "part") {
        parts[msg.seq as number] = msg.text as string;
        if (Object.keys(parts).length === msg.of) {
          const whole = Array.from({ length: msg.of as number }, (_, i) => parts[i]).join("");
          for (const k of Object.keys(parts)) delete parts[Number(k)];
          try {
            out.push(JSON.parse(whole));
          } catch {
            /* a torn line: skipped */
          }
        }
      } else out.push(msg);
    }
    return out;
  };

  return {
    name: o.name,
    async open(form, data) {
      if (tall && !resized) {
        const [w] = adb("shell", "wm", "size").match(/(\d+)x\d+/)!.slice(1);
        adb("shell", "wm", "size", `${w}x${tall}`);
        resized = true;
      }
      run = Math.random().toString(36).slice(2, 10);
      adb("logcat", "-c");
      const payload = Buffer.from(JSON.stringify(data ?? {})).toString("base64url");
      const link = `${o.url}/--/forms-scenario?form=${encodeURIComponent(form)}&data=${payload}&run=${run}`;
      // One string: the device's shell must not split the link at `&`.
      adb(
        "shell",
        `am start -a android.intent.action.VIEW -d '${link}' ${o.androidPackage ?? "host.exp.exponent"}`,
      );
      const end = Date.now() + (o.openTimeout ?? 180000);
      while (Date.now() < end) {
        if (lines().some((l) => l.kind === "ready")) {
          await sleep(settle * 2);
          return;
        }
        await sleep(500);
      }
      throw new Error(`${o.name}: "${form}" never reported it was drawn (is the app running at ${o.url}?)`);
    },
    async screen() {
      adb("shell", "uiautomator", "dump", "/sdcard/forms-scenario.xml");
      return withinForm(parse(adb("shell", "cat", "/sdcard/forms-scenario.xml")));
    },
    async tap(n) {
      adb("shell", "input", "tap", String(n.x + (n.w >> 1)), String(n.y + (n.h >> 1)));
      await sleep(settle);
    },
    async type(text, current) {
      // To the end, then delete what is there.
      adb("shell", "input", "keyevent", "KEYCODE_MOVE_END");
      if (current.length) adb("shell", "input", "keyevent", ...Array(current.length + 2).fill("67"));
      if (text) {
        const escaped = text.replace(/'/g, "'\\''").replace(/ /g, "%s");
        adb("shell", `input text '${escaped}'`);
      }
      await sleep(settle);
    },
    async scroll(direction) {
      // Within the screen as it is now, about two thirds of it per swipe.
      const [w, h] = adb("shell", "wm", "size")
        .match(/(\d+)x(\d+)\s*$/m)!
        .slice(1)
        .map(Number);
      const x = String(w! >> 1);
      const [from, to] = direction === "down" ? [h! * 0.8, h! * 0.2] : [h! * 0.2, h! * 0.8];
      adb("shell", "input", "swipe", x, String(Math.round(from)), x, String(Math.round(to)), "400");
      await sleep(settle);
    },
    async report(): Promise<Report> {
      const ls = lines();
      const data = [...ls].reverse().find((l) => l.kind === "data")?.data;
      const actions = ls
        .filter((l) => l.kind === "action")
        .map((l) => ({ actionId: l.actionId as string, data: l.data }));
      return { data, actions };
    },
    async close() {
      if (resized) adb("shell", "wm", "size", "reset");
      resized = false;
    },
  };
}
