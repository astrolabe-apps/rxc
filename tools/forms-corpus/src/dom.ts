/**
 * A DOM for React to mount into, in a script with no browser: happy-dom's
 * window, and the globals React and the renderers reach for. Shared by the
 * parity run and the looks run.
 */
import { Window } from "happy-dom";

export const win = new Window({ url: "http://localhost/" });
{
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  for (const k of [
    "document",
    "navigator",
    "location",
    "history",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "matchMedia",
    "Node",
    "Element",
    "HTMLElement",
    "SVGElement",
    "Text",
    "Comment",
    "DocumentFragment",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "InputEvent",
    "MutationObserver",
    "ResizeObserver",
    "IntersectionObserver",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "HTMLButtonElement",
    "HTMLFormElement",
    "HTMLDialogElement",
    "CSSStyleDeclaration",
    "DOMParser",
  ])
    if (g[k] === undefined)
      g[k] = (win as unknown as Record<string, unknown>)[k];
}

