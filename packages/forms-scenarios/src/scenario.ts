/**
 * A scenario: a form opened with some data, a sequence of what a user does,
 * and what they should then see — written against what is on the screen and
 * in the data, never against a renderer, so the same scenario runs on any app
 * that draws the form.
 *
 * @group Scenarios
 */
export interface Scenario {
  /** What it checks, in a sentence. */
  name: string;
  /** The form, by the name the target knows it by. */
  form: string;
  /** The data the form opens with. Default `{}`. */
  data?: unknown;
  /** What the user does and what they should see, in order. */
  steps: Step[];
}

/**
 * One step. The `press` / `fill` / `toggle` / `choose` steps act; the
 * `expect…` steps check, and fail the scenario when they do not hold.
 *
 * @group Scenarios
 */
export type Step =
  | {
      /** Press a control. */
      kind: "press";
      /** Its words or accessible name. */
      name: string;
    }
  | {
      /** Type into a field. */
      kind: "fill";
      /** The field's label. */
      label: string;
      /** What to type, replacing what it held. */
      text: string;
    }
  | {
      /** Toggle a checkbox or switch. */
      kind: "toggle";
      /** Its label. */
      label: string;
    }
  | {
      /** Choose an option. */
      kind: "choose";
      /** The question's label. */
      label: string;
      /** The option's words. */
      option: string;
    }
  | {
      /** Check words are on screen. */
      kind: "expectVisible";
      /** The words, or an accessible name. */
      text: string;
    }
  | {
      /** Check words are not on screen. */
      kind: "expectHidden";
      /** The words, or an accessible name. */
      text: string;
    }
  | {
      /** Check the form's data. */
      kind: "expectData";
      /** Where: `/`-separated keys, as a definition's `field`. */
      path: string;
      /** What it should hold, compared as JSON. */
      value: unknown;
    }
  | {
      /** Check an action's handler was called. */
      kind: "expectAction";
      /** The action's id. */
      actionId: string;
    };

/**
 * Press the button, link or other control named `name` — by its words or its
 * accessible name.
 *
 * @group Scenarios
 */
export const press = (name: string): Step => ({ kind: "press", name });

/**
 * Type `text` into the field labelled `label`, replacing what it held.
 *
 * @group Scenarios
 */
export const fill = (label: string, text: string): Step => ({ kind: "fill", label, text });

/**
 * Toggle the checkbox or switch labelled `label`.
 *
 * @group Scenarios
 */
export const toggle = (label: string): Step => ({ kind: "toggle", label });

/**
 * Choose `option` for the question labelled `label` — a radio option, or an
 * item of the select opened from it.
 *
 * @group Scenarios
 */
export const choose = (label: string, option: string): Step => ({ kind: "choose", label, option });

/**
 * `text` is on screen — an element's words or accessible name, exactly.
 *
 * @group Scenarios
 */
export const expectVisible = (text: string): Step => ({ kind: "expectVisible", text });

/**
 * `text` is not on screen.
 *
 * @group Scenarios
 */
export const expectHidden = (text: string): Step => ({ kind: "expectHidden", text });

/**
 * The form's data holds `value` at `path` (`a/b/0/c`, as a definition's
 * `field`), compared as JSON.
 *
 * @group Scenarios
 */
export const expectData = (path: string, value: unknown): Step => ({ kind: "expectData", path, value });

/**
 * The action `actionId` has been pressed since the form opened — the app
 * reports its handlers being called.
 *
 * @group Scenarios
 */
export const expectAction = (actionId: string): Step => ({ kind: "expectAction", actionId });

/**
 * A step as a sentence, for reports.
 *
 * @group Scenarios
 */
export function describeStep(s: Step): string {
  switch (s.kind) {
    case "press":
      return `press "${s.name}"`;
    case "fill":
      return `fill "${s.label}" with "${s.text}"`;
    case "toggle":
      return `toggle "${s.label}"`;
    case "choose":
      return `choose "${s.option}" for "${s.label}"`;
    case "expectVisible":
      return `see "${s.text}"`;
    case "expectHidden":
      return `not see "${s.text}"`;
    case "expectData":
      return `data ${s.path} = ${JSON.stringify(s.value)}`;
    case "expectAction":
      return `action "${s.actionId}" called`;
  }
}

/**
 * The value at `path` in `data`: `/`-separated keys, array indexes as numbers.
 *
 * @group Scenarios
 */
export function dataAt(data: unknown, path: string): unknown {
  let v = data;
  for (const k of path.split("/").filter(Boolean)) {
    if (v == null || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}
