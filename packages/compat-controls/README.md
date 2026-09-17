# @react-typed-forms/core v5

The v5 major of `@react-typed-forms/core`: the legacy v4 surface (including
its re-exported `@astroapps/controls`) reimplemented on top of the new
explicit-reactivity engine, `@rx-controls/core` + `@rx-controls/react`.

Migrating from v4 is a semver bump plus **one line** at your app root. Your
imports, your `.value` reads, your `groupedChanges` calls, and the
`@astroapps/swc-controls-plugin` SWC plugin all keep working unchanged.
(`@react-typed-forms/transform` was the older *Babel* plugin; either way the
injected `useComponentTracking()` imports from this package, so no build
config changes.)

Design: [`docs/COMPAT-CONTROLS-DESIGN.md`](https://github.com/astrolabe-apps/rxc/blob/main/docs/COMPAT-CONTROLS-DESIGN.md).

Moving *off* this package onto `@rx-controls/react` directly is a separate, optional step:
[`docs/MIGRATION-FROM-LEGACY-CORE.md`](https://github.com/astrolabe-apps/rxc/blob/main/docs/MIGRATION-FROM-LEGACY-CORE.md). Nothing
forces it — v5 is supported, and a half-migrated tree works.

## Installing

```bash
npm install @react-typed-forms/core
```

v5 is the current `latest`. It is a major version, so nothing upgrades into it
by accident — a v4 project stays on v4 until you bump the range yourself.

The engine packages (`@rx-controls/core`, `@rx-controls/react`) are ordinary
dependencies of this one, so they come along; you only need to depend on them
directly if you are also writing code against the new API.

## The one required change

```tsx
import { ControlContextProvider, getCompatContext } from "@react-typed-forms/core";

/** @noTrackControls */
export default function App({ children }) {
  return (
    <ControlContextProvider value={getCompatContext()}>
      <AppInner>{children}</AppInner>
    </ControlContextProvider>
  );
}
```

There is deliberately **no** no-provider fallback — a missing provider fails
loudly rather than silently giving you a second control context.

### Where the provider goes

It has to be the outermost thing in your client tree, and it needs a component
of its own. Two rules, both of which produce the identical error if you get
them wrong:

```
useControlContext: no ControlContext found. Wrap your app in <ControlContextProvider>.
```

**1. Nothing else in that component may call a control hook.** A hook called in
the *same* component that renders the provider still runs outside it. This is
easy to miss because the offending call is usually not yours — in a Next root
layout, `useNextNavigationService` calls `useControl` internally:

```tsx
// WRONG — useNextNavigationService runs above the provider it is meant to be under
export default function App({ children }) {
  const navigation = useNextNavigationService(routes);
  return (
    <ControlContextProvider value={getCompatContext()}>
      <Layout navigation={navigation}>{children}</Layout>
    </ControlContextProvider>
  );
}
```

Move everything down into a child component; the provider component should
render the provider and nothing else.

**2. Mark it `@noTrackControls` if you use the tracking plugin.** The SWC and
Babel plugins inject `useComponentTracking()` at the top of every component
they transform — including the one rendering the provider, so it runs above it.
The opt-out comment is honoured by both plugins. The component renders only the
provider, so it has nothing to track anyway.

If the provider lives in a `.ts` file (a shared HOC, say) rather than `.tsx`,
`createElement` works, but pass `children` inside the props object —
`createElement(ControlContextProvider, { value: getCompatContext(), children })`
— since the three-argument overload does not satisfy the provider's required
`children` prop.

**Diagnosing it.** The error surfaces at prerender/SSR naming a *page*, and a
different page on each run, because the real culprit is the shared layout and
prerender order varies. Don't chase the page. In the minified build the
throwing frame is `useControlContext` and its caller is `useComponentTracking`;
find that caller in the built chunk and it will be whichever component wraps
the provider.

## Why three packages and not one bundle

`src/patch.ts` mutates `ControlImpl.prototype` so that *every* control in the
process carries both the legacy and the new surface. That only holds if there
is exactly **one** copy of `@rx-controls/core` loaded.

If the engine were inlined into this package, a project that also imports
`@rx-controls/*` directly would end up with two `ControlImpl` classes: the patch would
land on one, the project's own controls would use the other, and the two would
stop interoperating. Since interoperating is the whole point — it is what lets
you migrate one component at a time — the packages stay separate, and keeping
them to one copy is left to the package manager.

**This is detected at load.** Both shapes — two copies of this package sharing
one engine, and two copies of the engine itself — are reported on `console.error`
the moment the patch runs, with the fix in the message. `getCompatPatchInfo()`
returns the same thing programmatically (`{ packageCopies, engineCopies,
duplicatePackage, duplicateEngine }`) if you want to assert it in a smoke test
or a startup health check.

The check deliberately runs however the process is built, not only in
development: the failure is silent staleness in production exactly as much as
in dev, and a duplicate usually appears in the production dependency graph
first. Strict ambient mode escalates it from a log to a throw.

Nothing else will tell you. Each copy keeps its own module-global ambient
collector, so a read reported by one copy never reaches a tracker installed by
the other — components subscribe to nothing and go stale — and strict ambient
mode is blind to it by construction, because from each copy's point of view
the read was collected perfectly normally.

Semver dedupe does that for you. If you depend on `@rx-controls/*` directly as
well and the versions will not resolve together, `pnpm.overrides` (or
`resolutions`) is the hammer:

```json
{
  "pnpm": {
    "overrides": {
      "@rx-controls/core": "<the version this package depends on>",
      "@rx-controls/react": "<the version this package depends on>"
    }
  }
}
```

## Incremental migration

Legacy and migrated components can share the same control:

```tsx
const shared = newControl({ count: 0 });

// still legacy — ambient reads, SWC plugin injects the tracking call
function LegacyView() {
  const stop = useComponentTracking();
  try {
    return <span>{shared.fields.count.value}</span>;
  } finally {
    stop();
  }
}

// migrated — explicit rc, closes its render pass with rendered()
function MigratedView() {
  const { rc, rendered } = useReactive();
  return rendered(<span>{rc.getValue(shared.fields.count)}</span>);
}
```

A write through either API updates both.

### Passing controls across the boundary

`shared` above is a compat `Control<V>`, and `MigratedView` hands it straight
to `rc.getValue` — no cast, no wrapper. That is the supported direction: a
compat `Control<V>` **is** a core `Control<V>` as far as TypeScript is
concerned, so your existing controls flow into `@rx-controls/react` hooks
and `rc`/`wc` methods unchanged. Migrate a component, keep the controls.

The reverse — a control created by `@rx-controls/core`'s `newControl` used
through the legacy API — needs `asLegacy`, because a core `Control<V>`
declares none of the legacy members:

```tsx
import { asLegacy } from "@react-typed-forms/core";

asLegacy(coreControl).fields.name.value = "Ada";
```

That is a type assertion with no runtime component: the prototype patch gives
*every* control in the process both surfaces, whichever `ControlContext`
created it.

**One trap.** Legacy reads are collected *ambiently* — they register a
dependency only inside `useComponentTracking` (what the SWC plugin injects),
`collectChanges`, or `withAmbient`. So this silently never re-renders:

```tsx
function Broken() {
  const { rc, rendered } = useReactive();
  //                       ↓ ambient read, no collector installed → subscribes to nothing
  return rendered(<span>{asLegacy(coreControl).fields.count.value}</span>);
}
```

There is no warning by default; the component just goes stale. Inside a
`useReactive()` body, read through the `rc` instead — it accepts the control
directly, so there was never a reason to reach for `asLegacy` there in the
first place.

### Strict mode — making that trap loud

`setStrictAmbient` turns the silent case into a warning or a throw. It is
**off by default**, dev-only, and costs a single boolean load when off, so
leaving it out of production builds is automatic rather than a discipline.

```ts
import { setStrictAmbient } from "@react-typed-forms/core";

setStrictAmbient(true); // shorthand for "throw"
setStrictAmbient("warn"); // console.warn, deduped per (call site, control)
setStrictAmbient(false); // back to the default
```

Switch it on without a code change via either escape hatch — the env var for
node/vitest/a dev server, the global for a browser bundle (set it from the
devtools console before the app mounts):

```bash
RTF_STRICT_AMBIENT=throw pnpm dev
```

```js
globalThis.RTF_STRICT_AMBIENT = "warn";
```

It reports **three** shapes, all of which return a correct current value and
register no dependency:

| Shape | What it means |
|---|---|
| No collector installed | The read ran outside any component body / `collectChanges` / `withAmbient`. The message says whether a collector has *ever* been installed — if not, the tracking plugin or `useComponentTracking` is simply not wired up. |
| Bridged onto a finalized `ReadContext` | `withAmbient(rc, fn)` ran after `rc`'s render pass closed — typically an `rc` captured from an enclosing `useReactive()` body, or a closure invoked from an effect rather than during render. |
| Collected by a disposed `SubscriptionTracker` | A collector *is* installed, so the read looks healthy, but the effect/computed that owns it was cleaned up. Its subscriptions notify a listener attached to nothing. |

Each message names the control by `uniqueId` and, where it has a parent, its
path, plus the facet that was read (`value`, `structure`, …).

**Most no-collector reads are correct**, which is why this is opt-in rather
than always on: event handlers, refs, effects and validators all read current
values on purpose. Strict mode cannot tell those apart from a stale render
read, so when it flags a deliberate one, read through `control.current.*` —
documented as untracked, and silent in every mode.

Turning it on also raises `@rx-controls/react`'s captured-`rc` diagnostic from
a warning to a throw, so one switch covers both halves of the same failure.

#### Hunting a staleness bug

1. Run with `RTF_STRICT_AMBIENT=warn` first and read the console — the warning
   names the control and the call site without stopping the app.
2. Narrow to `throw` once you know roughly where, so the stack points at the
   read.
3. If nothing fires at all, the read is being collected by a *live* tracker
   and the dependency really is registered — look at what is *notifying*
   instead (an equality bail-out, a `Structure`-only subscription that a
   same-length array replacement never trips).

## Known divergences from v4

1. **Per-control `equals` in `ControlSetup` is dropped.** The new engine has
   context-level equality only. Rare in the wild, but it fails silently — grep
   your codebase for `equals:` in a `ControlSetup` before upgrading.
2. **`runPendingChanges` is a no-op.** Transactions always flush on exit.
3. **Cleanup timing differs.** Legacy deferred tracker cleanup via
   `setTimeout(0)`; compat inherits the new context's 5s dead-tracker sweep.
   Observable only to code inspecting subscription counts.
4. **Listeners get a third argument** — `(control, change, wc)`. Two-arg
   legacy listeners are unaffected; anything inspecting `arguments.length`
   would see 3.
5. **Concurrent rendering** is no safer than it was. The ambient read
   collector is a module global set during render — the same hazard v4 has.
   Components ported to `useReactive()` become fully safe.
6. **This package is ESM only; v4 shipped dual.** v4 had `main:
   lib/index.cjs` and a `require` export condition; v5 has neither. Bundlers
   (Next, Vite, webpack) and vitest are unaffected, and Node >= 22.12 can
   `require()` it via require-ESM support. Two things do break: Node 20, and
   jest running CJS — jest passes `node_modules` through untransformed, so it
   needs `transformIgnorePatterns: ["/node_modules/(?!(@react-typed-forms|@rx-controls)/)"]`
   plus a babel-jest entry for `.js` (ts-jest will not do it; it only handles
   your own TS).
7. **Metrics and freeze-count APIs are no-op stubs**:
   `getControlMetrics`, `getHeavyControls`, `getControlById`,
   `printControlMetrics`, `printHeavyControls`, `ControlMetricsRegistry`,
   `unsafeFreezeCountEdit`. They exist so imports resolve, and do nothing.

Timing fidelity is explicitly not a goal — transaction flush order and cleanup
ticks follow [CONTROL-SEMANTICS.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/CONTROL-SEMANTICS.md), not v4's quirks.

## The legacy schemas stack

`@react-typed-forms/schemas` **does** run on this package, with one upstream
change. The obstacle was never the renderers: it was that the schema layer
reached the engine under a second package name, so bumping core to v5 would
leave you with two engines. But `@astroapps/controls` had exactly one consumer
— `@react-typed-forms/core`, which re-exported it wholesale — so the fix is to
retire it and point `@astroapps/forms-core` at this package instead. That is a
pure import-specifier rewrite; the compat surface exports all 20 names it uses.

Nothing else in the stack needs rebuilding. `@react-typed-forms/schemas`,
`schemas-html`, `@astroapps/schemas-datagrid` and `@astroapps/schemas-editor`
have **zero** runtime references to `@astroapps/controls` in their published
builds — the one import in `schemas-html` is type-only and elided — so they
keep working on their published versions. Four overrides do it: the three from
`pack-compat.mjs` plus a rebuilt `@astroapps/forms-core`.

Verified on a production app: six Next sites building and statically
exporting, with one copy of the engine and `@astroapps/controls` absent from
the install entirely.

This keeps a legacy host on the legacy renderer set while moving the engine
underneath — no renderer work, and nothing in your form definitions changes.
