import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { hasScreenServer, screenServer, type ScreenServer } from "./screenServer.js";
import { REPORT_PREFIX, withinForm, type Report, type ScreenNode, type Target } from "./target.js";

/**
 * Where an app runs on the device.
 *
 * @group Targets
 */
export interface AndroidTargetOptions {
  /** For reports: `legacy`, `v2`. */
  name: string;
  /**
   * The app's base link: `exp://127.0.0.1:8083` for an app in Expo Go. A port on
   * `127.0.0.1` or `localhost` is forwarded to the host (`adb reverse`).
   */
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
  /**
   * How the screen is read. `server`: through Appium's UiAutomator2 server, installed on
   * the device (about 50ms a read); `dump`: `uiautomator dump` (about two seconds). Default
   * `auto`, the server when the device has it.
   */
  screenReader?: "auto" | "server" | "dump";
  /** How long to wait for a form to report it is drawn — a first bundle can take minutes. Default 180s. */
  openTimeout?: number;
  /**
   * How long to let a form settle after an action, in ms. Default 200: a step waits for
   * what it needs anyway, and `uiautomator dump` for the app to go idle.
   */
  settle?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `$ADB`, else the Android SDK's at `~/Android/Sdk/platform-tools/adb`. */
export const defaultAdb = () => process.env.ADB ?? join(process.env.HOME ?? "", "Android/Sdk/platform-tools/adb");

/** How long the activity takes to restart after a `wm size` change. */
const RESIZE_SETTLE = 1600;

/**
 * A target on an Android device or emulator through `adb`: the screen from
 * the UiAutomator2 server when the device has it, else `uiautomator dump`, presses and typing through `input`, and the app's reports
 * from logcat (React Native logs `console.log` under `ReactNativeJS`), read as they are
 * logged from one `adb logcat` kept running until {@link Target.close}.
 *
 * @group Targets
 */
export function androidTarget(o: AndroidTargetOptions): Target {
  const ADB = o.adb ?? defaultAdb();
  const adb = (...a: string[]) => execFileSync(ADB, a, { maxBuffer: 1 << 28 }).toString();
  const settle = o.settle ?? 200;
  const tall = o.tallHeight ?? 6000;
  let run = "";
  let resized = false;
  let reversed = false;
  /** The screen server, `null` for `uiautomator dump`; chosen at the first read. */
  let reader: ScreenServer | null | undefined;

  // `uiautomator dump` names every element `node`; the server, by its class.
  const parse = (xml: string): ScreenNode[] =>
    [...xml.matchAll(/<(?!hierarchy\b)[\w.$]+ ([^>]*?)\/?>/g)].map((m) => {
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

  /** The report lines logged since the form opened, from a logcat started once. */
  let logcat: ChildProcess | undefined;
  let received: string[] = [];
  const listen = () => {
    if (logcat) return;
    adb("logcat", "-c");
    let rest = "";
    logcat = spawn(ADB, ["logcat", "-v", "raw", "-s", "ReactNativeJS:*"], { stdio: ["ignore", "pipe", "ignore"] });
    logcat.stdout!.setEncoding("utf8").on("data", (chunk: string) => {
      const ls = (rest + chunk).split("\n");
      rest = ls.pop()!;
      for (const l of ls) if (l.includes(REPORT_PREFIX)) received.push(l);
    });
  };

  /** This run's report lines, parts reassembled. */
  const lines = (): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    const parts: Record<number, string> = {};
    for (const l of received) {
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
        // The new size restarts the activity; a link sent while that happens is lost.
        await sleep(RESIZE_SETTLE);
      }
      listen();
      // A fresh emulator cannot reach the host's Metro at its own 127.0.0.1 until the port is forwarded.
      const local = o.url.match(/^\w+:\/\/(?:127\.0\.0\.1|localhost):(\d+)/);
      if (local && !reversed) {
        adb("reverse", `tcp:${local[1]}`, `tcp:${local[1]}`);
        reversed = true;
      }
      run = Math.random().toString(36).slice(2, 10);
      received = [];
      const payload = Buffer.from(JSON.stringify(data ?? {})).toString("base64url");
      const link = `${o.url}/--/forms-scenario?form=${encodeURIComponent(form)}&data=${payload}&run=${run}`;
      // One string: the device's shell must not split the link at `&`.
      const start = () =>
        adb(
          "shell",
          `am start -a android.intent.action.VIEW -d '${link}' ${o.androidPackage ?? "host.exp.exponent"}`,
        );
      start();
      const end = Date.now() + (o.openTimeout ?? 180000);
      // Expo Go switching from another project (the other target's) can drop the link; a
      // second one, once the app is up, reaches it as a `url` event.
      let nudge = Date.now() + 30000;
      while (Date.now() < end) {
        if (lines().some((l) => l.kind === "ready")) {
          await sleep(settle);
          return;
        }
        if (Date.now() > nudge) {
          start();
          nudge = Date.now() + 30000;
        }
        await sleep(100);
      }
      throw new Error(`${o.name}: "${form}" never reported it was drawn (is the app running at ${o.url}?)`);
    },
    async screen() {
      if (reader === undefined) {
        const want = o.screenReader ?? "auto";
        reader = null;
        if (want === "server" || (want === "auto" && hasScreenServer(ADB))) {
          try {
            reader = await screenServer(ADB);
          } catch (e) {
            if (want === "server") throw e;
            console.warn(`${o.name}: ${(e as Error).message}; reading the screen with uiautomator dump`);
          }
        }
      }
      if (reader) return withinForm(parse(await reader.source()));
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
        // A character at a time: a controlled field (legacy's numeric ones) kept only the
        // first one or two of a burst of keys while showing them all, about one run in ten.
        const escaped = [...text].map((c) => `input text '${c === " " ? "%s" : c.replace(/'/g, "'\\''")}'`);
        adb("shell", escaped.join("; "));
        // End the keyboard's composition. Gboard with a hardware keyboard declared (the
        // emulator's default) keeps the last word composing, and leaving the field then
        // commits it with a stray character — a space, an "r". Escape settles it in place.
        adb("shell", "input", "keyevent", "111");
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
      // Slowly enough that the list stops where the finger lifts. A quick swipe lifts while
      // moving and the list glides on (a fling) — two screens and more for a 400ms one, past
      // the part of the form the scan was looking for — and a tap on a list still moving only
      // stops it. Measured on an emulator: 800ms still glides, 1500ms does not.
      adb("shell", "input", "swipe", x, String(Math.round(from)), x, String(Math.round(to)), "1500");
      await sleep(settle);
    },
    async screenshot() {
      return execFileSync(ADB, ["exec-out", "screencap", "-p"], { maxBuffer: 1 << 28 });
    },
    async hideKeyboard() {
      // Back closes the keyboard; without one showing it would leave the app, so only then.
      if (/mInputShown=true/.test(adb("shell", "dumpsys input_method | grep mInputShown"))) {
        adb("shell", "input", "keyevent", "KEYCODE_BACK");
        await sleep(settle);
      }
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
      await reader?.release();
      reader = undefined;
      logcat?.kill();
      logcat = undefined;
      if (resized) adb("shell", "wm", "size", "reset");
      resized = false;
    },
  };
}
