/**
 * One element of what is on screen, as the platform's accessibility tree
 * reports it: its words, its accessible name, and where it is.
 *
 * @group Targets
 */
export interface ScreenNode {
  /** Its words. */
  text: string;
  /** Its accessible name, where that is not its words. */
  desc: string;
  /** The platform's class: `android.widget.EditText`, … */
  cls: string;
  /** Its test id, where the app gave one (React Native's `testID`). */
  id: string;
  /** It responds to a tap. */
  clickable: boolean;
  /** It is a checkbox, switch or radio: it has a checked state. */
  checkable: boolean;
  /** Its checked state. */
  checked: boolean;
  /** It is enabled. */
  enabled: boolean;
  /** Its left edge, in pixels. */
  x: number;
  /** Its top edge, in pixels. */
  y: number;
  /** Its width, in pixels. */
  w: number;
  /** Its height, in pixels. */
  h: number;
}

/**
 * What an app has reported since a form opened: its data now, and the actions
 * whose handlers were called, in order.
 *
 * @group Targets
 */
export interface Report {
  /** The form's data, as last reported. */
  data: unknown;
  /** The actions whose handlers were called, in order. */
  actions: {
    /** The action's id. */
    actionId: string;
    /** The payload it was called with. */
    data?: unknown;
  }[];
}

/**
 * An app a scenario runs against. The engine asks it to open a form and to
 * press and type; everything a scenario checks comes from {@link screen} and
 * {@link report}, so a target is any app that draws the form — legacy
 * renderers or Forms v2.
 *
 * @group Targets
 */
export interface Target {
  /** For reports: `legacy`, `v2`. */
  name: string;
  /** Open `form` with `data`, and wait until it is drawn. */
  open(form: string, data: unknown): Promise<void>;
  /** What is on screen now, in reading order. */
  screen(): Promise<ScreenNode[]>;
  /** Tap the middle of an element. */
  tap(node: ScreenNode): Promise<void>;
  /** Replace what the focused field holds with `text`; `current` is what it holds now. */
  type(text: string, current: string): Promise<void>;
  /** What the app has reported since the form opened. */
  report(): Promise<Report>;
  /**
   * Scroll the form by about a screen, `down` toward its end or `up` toward its start —
   * for a target whose screen does not show the whole form. Left out, the screen is
   * taken to show all of it.
   */
  scroll?(direction: "down" | "up"): Promise<void>;
  /**
   * Close the on-screen keyboard if it is showing, and do nothing if it is not. Left out,
   * a target is taken to have none.
   */
  hideKeyboard?(): Promise<void>;
  /** The screen as a PNG, for looking at. Left out, a target takes no pictures. */
  screenshot?(): Promise<Uint8Array>;
  /** Put the device back as it was. */
  close(): Promise<void>;
}

/**
 * The app's side of the protocol. An app is a target when it:
 *
 * - opens a form from a link — `<base>/--/forms-scenario?form=<name>&data=<base64url JSON>&run=<id>` —
 *   and logs {@link REPORT_PREFIX} `{"kind":"ready","run":"<id>"}` once the form is drawn;
 * - draws the form inside an element with the test id {@link FORM_TEST_ID}, so a scenario
 *   reads the form and not the app around it, and keeps development overlays (React
 *   Native's LogBox) off the screen while a scenario runs;
 * - logs `{"kind":"data","run":…,"data":…}` whenever the form's data changes;
 * - logs `{"kind":"action","run":…,"actionId":…,"data":…}` when an action's handler is called.
 *
 * Each is one `console.log` line: the prefix, then the JSON. A line longer than
 * {@link REPORT_CHUNK} is split into `{"kind":"part","run":…,"seq":i,"of":n,"text":…}`
 * lines, reassembled by the engine.
 *
 * @group Targets
 */
export const REPORT_PREFIX = "[forms-scenario] ";

/**
 * The test id of the element a target app draws the form inside.
 *
 * @group Targets
 */
export const FORM_TEST_ID = "forms-scenario-form";

/**
 * The elements inside the form's container ({@link FORM_TEST_ID}), the container
 * left out; all of them when the app marks none.
 *
 * @group Targets
 */
export function withinForm(nodes: ScreenNode[]): ScreenNode[] {
  const c = nodes.find((n) => n.id === FORM_TEST_ID || n.id.endsWith(`:id/${FORM_TEST_ID}`));
  if (!c) return nodes;
  return nodes.filter(
    (n) => n !== c && n.x >= c.x && n.y >= c.y && n.x + n.w <= c.x + c.w && n.y + n.h <= c.y + c.h,
  );
}

/**
 * The longest report line an app logs in one piece (logcat cuts a line near 4KB).
 *
 * @group Targets
 */
export const REPORT_CHUNK = 3000;

/** A label's words, compared without surrounding space or a trailing required marker. */
const norm = (s: string) => s.replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();

/** An element's words or accessible name. */
export const label = (n: ScreenNode) => n.text || n.desc;

/**
 * The first element whose words or accessible name are `words` — exactly,
 * ignoring surrounding space and a required marker. An element whose
 * accessible name merely starts with them (a row read as "label, state")
 * counts when nothing matches exactly.
 *
 * @group Targets
 */
export function findText(nodes: ScreenNode[], words: string): ScreenNode | undefined {
  const w = norm(words);
  return (
    nodes.find((n) => norm(n.text) === w || norm(n.desc) === w) ??
    nodes.find((n) => norm(n.desc).startsWith(w + ",") || norm(n.text).startsWith(w + ","))
  );
}

/**
 * A text field: an element a person types into.
 *
 * @group Targets
 */
export const isInput = (n: ScreenNode) => /EditText/.test(n.cls);
const isToggle = (n: ScreenNode) => n.checkable || /Switch|CheckBox/.test(n.cls);

/** The elements after `from` in reading order. */
const after = (nodes: ScreenNode[], from: ScreenNode) => nodes.slice(nodes.indexOf(from) + 1);

/**
 * The text field labelled `words`: the first input after the label, or an input
 * whose accessible name is the label.
 *
 * @group Targets
 */
export function findField(nodes: ScreenNode[], words: string): ScreenNode | undefined {
  const w = norm(words);
  const named = nodes.find((n) => isInput(n) && norm(n.desc) === w);
  if (named) return named;
  const l = findText(nodes, words);
  return l && after(nodes, l).find(isInput);
}

/**
 * The checkbox or switch labelled `words`: a checkable element named by it (a
 * row that is one accessible element), else the first checkable element after
 * the label.
 *
 * @group Targets
 */
export function findToggle(nodes: ScreenNode[], words: string): ScreenNode | undefined {
  const w = norm(words);
  const named = nodes.find((n) => isToggle(n) && (norm(n.desc) === w || norm(n.text) === w || norm(n.desc).startsWith(w + ",")));
  if (named) return named;
  const l = findText(nodes, words);
  return l && (isToggle(l) ? l : after(nodes, l).find(isToggle));
}

/**
 * The option `option` of the question labelled `words`, when it is on screen
 * (a radio option): the first element after the question with those words.
 *
 * @group Targets
 */
export function findOption(nodes: ScreenNode[], words: string, option: string): ScreenNode | undefined {
  const l = findText(nodes, words);
  if (!l) return undefined;
  const o = norm(option);
  return after(nodes, l).find((n) => norm(n.text) === o || norm(n.desc) === o);
}

/**
 * The first clickable element after the label `words` — a select's trigger.
 *
 * @group Targets
 */
export function findTrigger(nodes: ScreenNode[], words: string): ScreenNode | undefined {
  const l = findText(nodes, words);
  return l && after(nodes, l).find((n) => n.clickable);
}

/**
 * Whether a character is an icon font's glyph (the Private Use Area): words a
 * screen reader skips, and that one renderer draws as text and another as an
 * image.
 */
export const isGlyph = (s: string) => /^[\uE000-\uF8FF]+$/.test(s.trim());
