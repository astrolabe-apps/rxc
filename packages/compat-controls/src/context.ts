/**
 * Bridge 3 — the compat ControlContext.
 *
 * Reads and writes are context-free (Bridges 1–2 work on any control), so a
 * context is needed only where controls are *created*: `newControl`,
 * `controlGroup`, and the Phase-B hooks. Legacy code has no context concept,
 * so compat owns a module singleton.
 *
 * SSR note: like legacy's module-global uniqueId counter, the singleton's id
 * sequence runs on across requests. Hosts that need deterministic
 * SSR/hydration ids call `setCompatContext(createControlContext())` per
 * request/root (or mount a `ControlContextProvider` once Phase B lands).
 */

import { createControlContext } from "@rxc/controls-core";
import type { ControlContext } from "@rxc/controls-core";

let compatContext: ControlContext = createControlContext();

/** The ControlContext compat-created controls belong to. */
export function getCompatContext(): ControlContext {
  return compatContext;
}

/** Replace the compat context (e.g. per SSR request). Controls created under
 * the previous context keep working — only creation and tree-equality are
 * context-bound. */
export function setCompatContext(ctx: ControlContext): void {
  compatContext = ctx;
}
