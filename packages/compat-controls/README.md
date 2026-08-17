# @react-typed-forms/core v5

The v5 major of `@react-typed-forms/core`: the legacy v4 surface (including
its re-exported `@astroapps/controls`) reimplemented on top of the new
explicit-reactivity engine, `@rxc/controls-core` + `@rxc/controls`.

Migrating from v4 is a semver bump plus **one line** at your app root. Your
imports, your `.value` reads, your `groupedChanges` calls, and the
`@react-typed-forms/transform` SWC plugin all keep working unchanged.

Design: [`docs/COMPAT-CONTROLS-DESIGN.md`](../../docs/COMPAT-CONTROLS-DESIGN.md).

## The one required change

```tsx
import { ControlContextProvider, getCompatContext } from "@react-typed-forms/core";

export default function App({ children }) {
  return (
    <ControlContextProvider value={getCompatContext()}>
      {children}
    </ControlContextProvider>
  );
}
```

There is deliberately **no** no-provider fallback — a missing provider fails
loudly rather than silently giving you a second control context.

## Trying it before it is published

The three packages are not on the registry yet, so pack them from the rxc repo:

```bash
node scripts/pack-compat.mjs --out /some/vendor/dir
```

Packing itself is plain Rush — `rush publish --publish --pack --include-all
--release-folder <dir>` — and you can run that directly. The helper adds two
things: it writes the `overrides.json` below, and it scopes the preceding build
to the publishable packages. A bare `rush build` currently exits 1 (the two
legacy Next apps warn that ESLint isn't installed, and Rush treats "succeeded
with warnings" as a failure), which would otherwise abort packing.

In the consuming project, add those to **`pnpm.overrides`** (or, in a Rush repo,
`globalOverrides` in `common/config/rush/pnpm-config.json`):

```json
{
  "pnpm": {
    "overrides": {
      "@rxc/controls-core": "file:/some/vendor/dir/rxc-controls-core-0.1.0.tgz",
      "@rxc/controls": "file:/some/vendor/dir/rxc-controls-0.1.0.tgz",
      "@react-typed-forms/core": "file:/some/vendor/dir/react-typed-forms-core-5.0.0.tgz"
    }
  }
}
```

**Overrides, not plain dependencies.** Listing the tarballs as ordinary
`dependencies` is not enough: the compat tarball's own manifest asks for
`@rxc/controls-core@0.1.0`, which the package manager will then try to fetch
from the registry and fail with a 404. Overrides force every reference —
direct and transitive — onto the same tarball.

## Why three tarballs and not one bundle

`src/patch.ts` mutates `ControlImpl.prototype` so that *every* control in the
process carries both the legacy and the new surface. That only holds if there
is exactly **one** copy of `@rxc/controls-core` loaded.

If the engine were inlined into this package, a project that also imports
`@rxc/*` directly would end up with two `ControlImpl` classes: the patch would
land on one, the project's own controls would use the other, and the two would
stop interoperating. Since interoperating is the whole point — it is what lets
you migrate one component at a time — the packages stay separate and the
overrides above keep them deduplicated.

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
  const { rc, rendered } = useControls();
  return rendered(<span>{rc.getValue(shared.fields.count)}</span>);
}
```

A write through either API updates both.

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
   Components ported to `useControls()` become fully safe.
6. **Metrics and freeze-count APIs are no-op stubs**:
   `getControlMetrics`, `getHeavyControls`, `getControlById`,
   `printControlMetrics`, `printHeavyControls`, `ControlMetricsRegistry`,
   `unsafeFreezeCountEdit`. They exist so imports resolve, and do nothing.

Timing fidelity is explicitly not a goal — transaction flush order and cleanup
ticks follow `docs/CONTROL-SEMANTICS.md`, not v4's quirks.

## Not covered

`@react-typed-forms/schemas` does **not** run on this package. Its renderer
stack reaches the engine through a separate package name
(`@astroapps/forms-core` → `@astroapps/controls`), so bumping core to v5 swaps
only the half your own code touches and leaves you with two engines. Legacy
schemas hosts port directly onto `@rxc/forms` — see
[`docs/MIGRATION-FROM-LEGACY.md`](../../docs/MIGRATION-FROM-LEGACY.md).
