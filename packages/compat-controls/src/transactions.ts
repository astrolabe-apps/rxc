/**
 * Bridge 2 — ambient write transactions.
 *
 * The new engine's `WriteContextImpl` is context-free: create one, mutate
 * through it, `flush()`. Legacy code has no `wc` to thread, so this bridge
 * keeps an ambient "currently open" write context: setters open-and-flush a
 * fresh one per mutation, while `groupedChanges` holds one open across its
 * callback so nested writes coalesce into a single notification flush —
 * exactly the observable behavior of legacy's global freeze counter.
 */

import type { WriteContext } from "@rx-controls/core";
import { WriteContextImpl } from "@rx-controls/core/internal";

let currentWc: WriteContextImpl | null = null;

/**
 * Run `fn` inside the open ambient write transaction, or open (and flush) a
 * fresh one around it. Every compat mutation funnels through here.
 */
export function runInWc<A>(fn: (wc: WriteContext) => A): A {
  if (currentWc) return fn(currentWc);
  const wc = new WriteContextImpl();
  currentWc = wc;
  try {
    return fn(wc);
  } finally {
    try {
      // The wc stays ambient through its own flush: compat writes and
      // `addAfterChangesCallback` calls made from inside subscription
      // listeners join this transaction (flush's drain loops pick them up),
      // reproducing legacy's single listener storm per transaction. The
      // effects API depends on this — an Effect defers its re-run via
      // addAfterChangesCallback from inside a listener, coalescing several
      // dependency changes in one transaction into one run.
      wc.flush();
    } finally {
      currentWc = null;
    }
  }
}

/**
 * Batch all writes made inside `run` into one transaction: subscribers are
 * notified once, after `run` returns, however many controls changed.
 */
export function groupedChanges<A>(run: () => A): A {
  return runInWc(() => run());
}

/** Legacy per-control transaction — the control argument was only ever used
 * for its freeze counter; batching semantics are {@link groupedChanges}. */
export function runTransaction(
  _control: unknown,
  run: () => void,
): void {
  runInWc(() => run());
}

/**
 * Run `cb` after the current transaction's notifications settle. Outside a
 * transaction it runs after an (empty) flush — effectively immediately, but
 * always after any in-flight listener storm.
 */
export function addAfterChangesCallback(cb: () => void): void {
  runInWc((wc) => wc.afterFlush(cb));
}

/**
 * Legacy safety valve that drained a global pending queue. The new engine
 * flushes on every transaction exit, so there is never anything pending —
 * kept as a no-op for source compatibility.
 */
export function runPendingChanges(): void {}

/** Legacy escape hatch into the global freeze counter. No analogue in the
 * new engine — no-op stub. */
export function unsafeFreezeCountEdit(_dir: number): void {}
