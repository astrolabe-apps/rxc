"use client";

/**
 * Demonstrates the render boundary from `docs/RENDER-BOUNDARY.md`:
 * what breaks when a component skips `rendered(…)`, and what the dev-mode
 * guard tells you about it.
 *
 * The failure is silent by design of the underlying model — reads are
 * *tracked* during render but only become live *subscriptions* when
 * `rendered(…)` reconciles them. Miss it and the component renders correct
 * output once, then never updates again. Nothing throws.
 */

import { memo, useEffect, useRef, useState } from "react";
import {
  ControlContextProvider,
  createControlContext,
  useControlContext,
  useReactive,
  type Control,
  type Rendered,
} from "@rx-controls/react";

const controlContext = createControlContext();

// ── Capturing the warning ────────────────────────────────────────────
//
// The guard fires from a passive effect during the *first commit*, and child
// effects run before ancestor effects — so no component on this page could
// install a spy in time. Patch at module scope instead.

const captured: string[] = [];
let onCapture: (() => void) | undefined;

if (typeof window !== "undefined") {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = String(args[0] ?? "");
    if (first.startsWith("[@rx-controls/react]")) {
      captured.push(first);
      onCapture?.();
    }
    original(...args);
  };
}

function CapturedWarnings() {
  const [, bump] = useState(0);
  useEffect(() => {
    onCapture = () => bump((n) => n + 1);
    // Warnings emitted before this effect ran are already in `captured`.
    bump((n) => n + 1);
    return () => {
      onCapture = undefined;
    };
  }, []);

  return (
    <div>
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        Anything <code>@rx-controls/react</code> wrote to <code>console.error</code>,
        mirrored here so you don&apos;t need devtools open:
      </p>
      {captured.length === 0 ? (
        <p className="rounded bg-zinc-100 p-3 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          Nothing captured yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {captured.map((m, i) => (
            <li
              key={i}
              className="rounded border border-amber-300 bg-amber-50 p-3 font-mono text-xs leading-relaxed break-words text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            >
              {m}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        The guard de-duplicates by <em>call site</em>, so each offending
        component warns <strong>once per page load</strong> — remounting
        won&apos;t warn again, and the two <code>ConditionalField</code>{" "}
        instances above collapse to a single warning because they share one call
        site. Reload to see them fresh.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong>Development builds only.</strong> The check is a module-scope{" "}
        <code>process.env.NODE_ENV</code> comparison, which bundlers replace
        statically — in a production build this whole guard, its message, and the
        per-mount stack capture that names the component are dead-code
        eliminated. So <code>next dev</code> shows warnings here;{" "}
        <code>next build &amp;&amp; next start</code> shows none, while the three
        broken components stay just as broken.
      </p>
    </div>
  );
}

// ── The demo components ──────────────────────────────────────────────

interface DemoProps {
  counter: Control<number>;
}

/** Correct: every return path goes through `rendered(…)`. */
function CorrectFieldRender({ counter }: DemoProps): Rendered {
  const { rc, rendered } = useReactive();
  const renders = useRef(0);
  renders.current++;
  return rendered(
    <Readout
      kind="correct"
      title="CorrectField"
      value={rc.getValue(counter)}
      renders={renders.current}
      note="Calls rendered(…), so its read of `counter` became a live subscription."
    />,
  );
}

/**
 * Broken: reads through `rc`, then returns the JSX directly.
 *
 * This only compiles because of the cast. Without it, TypeScript rejects the
 * return — that's the primary line of defence (see the "compile-time" section
 * below); the runtime guard exists for the cases the type can't reach.
 */
function BrokenFieldRender({ counter }: DemoProps): Rendered {
  const { rc } = useReactive();
  const renders = useRef(0);
  renders.current++;
  return (
    <Readout
      kind="broken"
      title="BrokenField"
      value={rc.getValue(counter)}
      renders={renders.current}
      note="Skipped rendered(…). The read was tracked but never subscribed, so this is frozen at its mount value."
    />
  ) as unknown as Rendered;
}

/**
 * Broken in the way it actually happens in real code: the boundary is on the
 * main return but missing from an early return — `if (!c.data) return null;`
 * above a correct `return rendered(…)`. This is the shape that bit three
 * renderers during the port.
 *
 * The subtlety this demonstrates: whether the bug is *visible* depends on which
 * path the component's **first** render takes. `reconcile()` is the only thing
 * that mutates the subscription set, so a subscription established on a good
 * render survives every later render that skips the boundary. Mount on the good
 * path and the bug is completely invisible; mount on the bad path and the
 * component is dead on arrival. Same code, same control.
 *
 * `skipOn` picks which parity takes the un-boundaried path, so the two
 * instances below differ only in mount-time luck.
 */
function ConditionalFieldRender({
  counter,
  skipOn,
}: DemoProps & { skipOn: "even" | "odd" }): Rendered {
  const { rc, rendered } = useReactive();
  const renders = useRef(0);
  renders.current++;
  const value = rc.getValue(counter);
  const skipping = skipOn === "even" ? value % 2 === 0 : value % 2 === 1;

  if (skipping) {
    // ← the bug: this path never reconciles
    return (
      <Readout
        kind="broken"
        title={`ConditionalField (skips on ${skipOn})`}
        value={value}
        renders={renders.current}
        note={
          renders.current === 1
            ? "Its FIRST render took the un-boundaried path, so it never subscribed at all. Dead on arrival."
            : "On the un-boundaried path now — but it already subscribed on an earlier good render, and those subscriptions survive."
        }
      />
    ) as unknown as Rendered;
  }

  return rendered(
    <Readout
      kind="correct"
      title={`ConditionalField (skips on ${skipOn})`}
      value={value}
      renders={renders.current}
      note="On the correct path — reconciling normally."
    />,
  );
}

// `memo` so a parent re-render can't drag these along — only their own
// subscriptions may re-render them. This mirrors `memo(Field)` in `@rx-controls/forms`,
// and without it the parent's own reactivity would mask the whole failure.
const CorrectField = memo(CorrectFieldRender);
const BrokenField = memo(BrokenFieldRender);
const ConditionalField = memo(ConditionalFieldRender);

// ── Presentation ─────────────────────────────────────────────────────

function Readout({
  kind,
  title,
  value,
  renders,
  note,
}: {
  kind: "correct" | "broken";
  title: string;
  value: number;
  renders: number;
  note: string;
}) {
  const tone =
    kind === "correct"
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
      : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950";
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <h3 className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-2 text-4xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {renders} render{renders === 1 ? "" : "s"}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        {note}
      </p>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {heading}
      </h2>
      {children}
    </section>
  );
}

const TS_ERROR = `error TS2322: Type 'Element' is not assignable to type 'Rendered'.
  Property '[callRendered]' is missing in type 'ReactElement<any, any>'
    but required in type '{ readonly [callRendered]: never; }'`;

// ── Page ─────────────────────────────────────────────────────────────

function RenderBoundaryInner(): Rendered {
  const { rc, rendered } = useReactive();
  const ctx = useControlContext();
  const counterRef = useRef<Control<number> | null>(null);
  if (!counterRef.current) counterRef.current = ctx.newControl(1);
  const counter = counterRef.current;

  return rendered(
    <div className="min-h-screen bg-zinc-50 p-6 font-sans dark:bg-black">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Render boundary — missing <code>rendered(…)</code>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Reads through <code>rc</code> are <em>tracked</em> during render but
            only become live <em>subscriptions</em> when{" "}
            <code>rendered(…)</code> reconciles them. Skip it and the component
            renders correctly once, then never updates. Nothing throws — which
            is why there are two lines of defence: the{" "}
            <code>Rendered</code> return type at compile time, and a dev-mode
            warning for the cases types can&apos;t reach.
          </p>
        </header>

        <Section heading="1. Watch the failure">
          <button
            type="button"
            // `valueNow`, not `rc.getValue` — an untracked read, so this page
            // shell never subscribes to the counter and never re-renders. If it
            // did, its re-render would cascade past `memo` boundaries only for
            // changed props, but any un-memoized child would update anyway and
            // the demo would silently lie.
            onClick={() =>
              ctx.update((wc) => wc.setValue(counter, counter.valueNow + 1))
            }
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Increment counter
          </button>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CorrectField counter={counter} />
            <BrokenField counter={counter} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <code>BrokenField</code> is frozen at the value it read when it
            mounted. It isn&apos;t erroring — it simply has no subscription, so
            nothing ever tells it to render again.
          </p>
          <h3 className="mt-8 mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            The same bug, twice — with opposite symptoms
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Both of these are the realistic shape:{" "}
            <code>if (…) return null;</code> above a correct{" "}
            <code>return rendered(…)</code>. They differ only in{" "}
            <em>which</em> parity takes the un-boundaried path — i.e. only in
            what their first render happened to do. The counter starts odd.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ConditionalField counter={counter} skipOn="even" />
            <ConditionalField counter={counter} skipOn="odd" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            The left one mounted on its <em>good</em> path, so it subscribed —
            and because <code>reconcile()</code> is the only thing that mutates
            the subscription set, that subscription <strong>survives</strong>{" "}
            every later render that skips the boundary. It keeps working, and the
            bug is invisible. The right one mounted on its <em>bad</em> path and
            never subscribed at all, so it is dead on arrival.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Same code, same control, opposite outcomes decided by mount-time
            luck. That is the case for enforcing this with a type instead of
            trusting review or testing — and note that the warning below fires
            for <strong>both</strong>, including the one showing no symptom.
          </p>
        </Section>

        <Section heading="2. The dev-mode warning">
          <CapturedWarnings />
        </Section>

        <Section heading="3. Why these compile at all">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            They don&apos;t, without help. Both broken components above carry an
            explicit <code>as unknown as Rendered</code> cast; delete it and the
            build fails at the offending <code>return</code>:
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
            {TS_ERROR}
          </pre>
          <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            Only <code>rendered()</code> can produce a <code>Rendered</code>, so
            annotating a renderer <code>): Rendered</code> makes every missed
            return path a build error — reported at the <code>return</code>{" "}
            itself, not at the function. The runtime guard covers what the type
            cannot: components that don&apos;t annotate a return type, and files
            outside <code>tsconfig</code>&apos;s <code>include</code> (this is
            how a test file lost its <code>rendered(…)</code> calls during the
            port and silently stopped re-rendering).
          </p>
        </Section>

        <nav className="text-sm">
          <a
            href="/"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← back to demos
          </a>
        </nav>
      </div>
    </div>,
  );
}

export default function Page() {
  return (
    <ControlContextProvider value={controlContext}>
      <RenderBoundaryInner />
    </ControlContextProvider>
  );
}
