// The app's side of the form-scenario protocol (see `REPORT_PREFIX` in the main entry), with no
// Node and no React: for an app that is a scenario target — React Native or the web.
// A scenario opens a form by link, and reads back what the app reports through logcat.

/**
 * What a scenario's link asks for: a form, the data it opens with, and the run it reports under.
 *
 * @group App
 */
export interface ScenarioLink {
  /** The form's name. */
  form: string;
  /** The data it opens with. */
  data: unknown;
  /** The run its reports are under. */
  run: string;
}

const PREFIX = "[forms-scenario] ";

/**
 * The test id to give the element the form is drawn inside (React Native's `testID`):
 * a scenario reads only what is inside it.
 *
 * @group App
 */
export const FORM_TEST_ID = "forms-scenario-form";
/** logcat cuts a line near 4KB: a longer report goes in parts. */
const CHUNK = 3000;

/**
 * The scenario a link opens — `<base>/--/forms-scenario?form=…&data=<base64url JSON>&run=…` —
 * or `undefined` for any other link.
 *
 * @group App
 */
export function scenarioFromLink(url: string): ScenarioLink | undefined {
  const [path, query = ""] = url.split("?");
  if (!path?.endsWith("/forms-scenario")) return undefined;
  const q = Object.fromEntries(
    query.split("&").map((kv) => {
      const [k = "", v = ""] = kv.split("=");
      return [decodeURIComponent(k), decodeURIComponent(v)];
    }),
  );
  if (!q.form) return undefined;
  return { form: q.form, data: q.data ? JSON.parse(fromBase64Url(q.data)) : {}, run: q.run ?? "" };
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  // atob gives bytes; the JSON is UTF-8.
  return decodeURIComponent(Array.from(bin, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
}

/**
 * Report to the scenario engine for a run: `{ kind: "ready" }` once the form is
 * drawn, `{ kind: "data", data }` as it changes, `{ kind: "action", actionId, data }`
 * when a handler is called. One `console.log` line, in parts when long. Nothing
 * for an empty run (a form not opened by a scenario).
 *
 * @group App
 */
export function report(run: string, msg: Record<string, unknown>) {
  if (!run) return;
  const line = JSON.stringify({ ...msg, run });
  if (line.length <= CHUNK) {
    console.log(PREFIX + line);
    return;
  }
  const of = Math.ceil(line.length / CHUNK);
  for (let seq = 0; seq < of; seq++)
    console.log(PREFIX + JSON.stringify({ kind: "part", run, seq, of, text: line.slice(seq * CHUNK, (seq + 1) * CHUNK) }));
}
