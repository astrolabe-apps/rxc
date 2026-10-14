import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The UiAutomator2 server's instrumentation — Appium's (`appium-uiautomator2-server`,
 * Apache-2.0): installed on a device, it keeps one UiAutomation connection open and
 * answers for the screen over HTTP in about 50ms, where each `uiautomator dump` starts
 * a process on the device and takes about two seconds.
 */
export const SCREEN_SERVER = "io.appium.uiautomator2.server.test/androidx.test.runner.AndroidJUnitRunner";
const SERVER_PACKAGES = ["io.appium.uiautomator2.server.test", "io.appium.uiautomator2.server"];
const DEVICE_PORT = 6790;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The npm package carrying the server's two APKs, at the version this engine is tested with. */
export const SCREEN_SERVER_PACKAGE = "appium-uiautomator2-server@10.7.0";

/**
 * Install the server on the device `adb` reaches: the two APKs from
 * {@link SCREEN_SERVER_PACKAGE}, fetched with `npm pack` into a temporary directory.
 */
export function installScreenServer(adb: string): void {
  const dir = mkdtempSync(join(tmpdir(), "forms-scenarios-"));
  try {
    const tgz = execFileSync("npm", ["pack", SCREEN_SERVER_PACKAGE, "--silent"], { cwd: dir }).toString().trim();
    execFileSync("tar", ["xzf", tgz], { cwd: dir });
    const apks = join(dir, "package", "apks");
    for (const apk of readdirSync(apks).filter((f) => f.endsWith(".apk")))
      execFileSync(adb, ["install", "-r", "-g", "-t", join(apks, apk)], { stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A running server: the screen as XML, in `uiautomator dump`'s attributes. */
export interface ScreenServer {
  source(): Promise<string>;
  release(): Promise<void>;
}

interface Running {
  users: number;
  base: string;
  instrument: ChildProcess;
  hostPort: string;
}

/**
 * One server per device, shared by every target on it (a differential run's two apps):
 * a device has only one UiAutomation connection to give.
 */
const running = new Map<string, Promise<Running>>();

/** Whether the server is installed on the device `adb` reaches. */
export function hasScreenServer(adb: string): boolean {
  try {
    return execFileSync(adb, ["shell", "pm", "list", "instrumentation"]).toString().includes(SCREEN_SERVER.split("/")[0]!);
  } catch {
    return false;
  }
}

async function start(adb: string): Promise<Running> {
  const run = (...a: string[]) => execFileSync(adb, a).toString().trim();
  // A server left from a run that did not close it would hold the connection.
  for (const p of SERVER_PACKAGES) run("shell", "am", "force-stop", p);
  const instrument = spawn(adb, ["shell", "am", "instrument", "-w", "-e", "disableAnalytics", "true", SCREEN_SERVER], {
    stdio: "ignore",
  });
  const hostPort = run("forward", "tcp:0", `tcp:${DEVICE_PORT}`);
  const root = `http://127.0.0.1:${hostPort}/wd/hub`;
  const end = Date.now() + 30000;
  for (;;) {
    try {
      if ((await fetch(`${root}/status`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > end) {
      instrument.kill();
      throw new Error("the UiAutomator2 server did not start");
    }
    await sleep(250);
  }
  const post = async (path: string, body: unknown) =>
    (await (
      await fetch(`${root}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    ).json()) as { value: { sessionId?: string } };
  // Its default tree is `uiautomator dump`'s but for elements clipped to nothing, which no
  // step can use. (`allowInvisibleElements` would add more than the dump has: a wizard's other
  // pages, and an element hidden with placeholder bounds that a press then found and missed.)
  const session = (await post("/session", { capabilities: { alwaysMatch: {} } })).value.sessionId!;
  return { users: 0, base: `${root}/session/${session}`, instrument, hostPort };
}

/** The device's server, started for the first target to ask. */
export async function screenServer(adb: string): Promise<ScreenServer> {
  let r = running.get(adb);
  if (!r) running.set(adb, (r = start(adb)));
  const s = await r.catch((e) => {
    running.delete(adb);
    throw e;
  });
  s.users++;
  let released = false;
  return {
    async source() {
      const res = (await (await fetch(`${s.base}/source`)).json()) as { value: string };
      return res.value;
    },
    async release() {
      if (released) return;
      released = true;
      if (--s.users) return;
      running.delete(adb);
      await fetch(s.base, { method: "DELETE" }).catch(() => undefined);
      s.instrument.kill();
      // Let `uiautomator dump` and anything else have the connection back.
      for (const p of SERVER_PACKAGES) execFileSync(adb, ["shell", "am", "force-stop", p]);
      execFileSync(adb, ["forward", "--remove", `tcp:${s.hostPort}`]);
    },
  };
}
