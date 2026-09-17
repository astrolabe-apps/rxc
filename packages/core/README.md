# @rx-controls/core

A reactive control tree for form and application state, in plain TypeScript.
**Zero dependencies, no React, no globals.**

A `Control<V>` holds a value, a clean baseline, validation errors, and
touched/disabled flags. Controls compose: navigating `form.fields.address.fields.city`
lazily materialises a child control, and value changes propagate both up and down the
tree. What makes it reactive is that reads and writes go through explicit contexts
rather than ambient globals — so the thing that re-runs when a value changes is exactly
the thing that read it.

Using React? Install [`@rx-controls/react`](https://www.npmjs.com/package/@rx-controls/react)
instead — it re-exports all of this package plus the React adapter.

```bash
npm install @rx-controls/core
```

## The four objects

| | |
|---|---|
| **`Control<V>`** | A node in the tree. Holds value, initial value, errors, touched/disabled. Navigate with `.fields` and `rc.getElements(…)`. |
| **`ReadContext`** (`rc`) | A reactive read scope. Reading through it registers a dependency on that *(control, facet)* pair. |
| **`WriteContext`** (`wc`) | A write batch. All mutation goes through one; subscribers are notified once, after the batch. |
| **`ControlContext`** (`ctx`) | The factory and runtime: creates controls, opens write batches, owns the equality function. |

`ReadContext` is **not** a render-time facility — a React render pass is just one of the
things that opens one, alongside `computeInto`, `effect` and validators.

## Quick start

```ts
import { createControlContext, effect } from "@rx-controls/core";

const ctx = createControlContext();

const form = ctx.newControl({ firstName: "Ada", lastName: "Lovelace" });

// A reactive computation. Re-runs whenever a control it read changes.
const handle = effect(ctx, (rc) => {
  const first = rc.getValue(form.fields.firstName);
  const last = rc.getValue(form.fields.lastName);
  console.log(`${first} ${last}`);
});
// → "Ada Lovelace"

// All writes go through a batch. Subscribers fire once, after the callback.
ctx.update((wc) => {
  wc.setValue(form.fields.firstName, "Grace");
  wc.setValue(form.fields.lastName, "Hopper");
});
// → "Grace Hopper"   (one run, not two)

form.valueNow;  // { firstName: "Grace", lastName: "Hopper" }  — untracked snapshot
form.dirtyNow;  // true — differs from the initial value

handle.cleanup();
```

Note `form.fields.firstName` — the child control did not exist until that property was
touched, and writing it updated the parent's value too.

## Reading

Every reactive read is a method on `rc`:

```ts
rc.getValue(c)          rc.getInitialValue(c)
rc.isValid(c)           rc.isDirty(c)
rc.isTouched(c)         rc.isDisabled(c)      rc.isNull(c)
rc.getError(c)          rc.getErrors(c)
rc.getElements(c)       // array elements, tracks structure
rc.getTrackedValue(c)   // deep per-field proxy — fine-grained reads into a value tree
rc.trackValidate(c)     // re-run on validate() broadcasts; reads nothing
```

Each registers a dependency on that facet alone, so a computation reading `rc.isValid(c)`
doesn't re-run when the value changes without crossing the validity boundary.

**Untracked snapshots** need no `rc` and subscribe to nothing — use them in event
handlers and callbacks, where there is nothing to re-run:

```ts
c.valueNow      c.initialValueNow   c.validNow      c.dirtyNow
c.touchedNow    c.disabledNow       c.errorNow      c.errorsNow
c.isNullNow     c.elementsNow       c.existingFields
```

`untrackedRead` is a `ReadContext` that subscribes to nothing, for code that must accept
an `rc` but has no scope of its own.

## Writing

Mutation only exists inside `ctx.update(…)`:

```ts
ctx.update((wc) => {
  wc.setValue(c, v);
  wc.updateValue(c, (current) => current + 1);
  wc.reset(c, v);              // value AND baseline — leaves the control clean
  wc.setInitialValue(c, v);    // baseline alone — the control goes dirty
  wc.markClean(c);

  wc.setTouched(c, true);
  wc.setDisabled(c, true);
  wc.setError(c, "key", "message");
  wc.setErrors(c, { key: "message" });
  wc.clearErrors(c);
  wc.validate(c);

  wc.addElement(arr, item);
  wc.removeElement(arr, item);
  wc.updateElements(arr, (elems) => [...elems].reverse());
  wc.setElementIncluded(arr, item, true);   // treats the array as a set

  wc.afterFlush(() => { /* runs once notification completes */ });
});
```

**`update` batches notification, not the writes.** Values change immediately; subscribers
fire once at the end. There is no staging and **no rollback** — if the callback throws,
the writes it already made are published and the error is rethrown, so the tree and its
subscribers stay consistent with each other either way. It does not nest: calling `update`
from inside a listener opens a separate batch that flushes inline.

Two rows above are worth reading twice. `reset` sets value *and* baseline; `setInitialValue`
moves the baseline alone. Mixing them up compiles cleanly.

## Reactive computations

```ts
import { computeInto, effect } from "@rx-controls/core";

// Write a derived value into a target control, keeping it up to date.
const computed = computeInto(ctx, totalControl, (rc) =>
  rc.getElements(items).reduce((sum, i) => sum + rc.getValue(i.fields.price), 0),
);

// A side effect, with optional cleanup.
const watcher = effect(ctx, (rc) => {
  const id = rc.getValue(selectedId);
  const timer = setInterval(() => poll(id), 1000);
  return () => clearInterval(timer);
});

computed.cleanup();
watcher.cleanup();
```

Both return a handle: `cleanup()` disposes, `rerun()` (effects) re-runs while re-tracking,
and `replaceCompute` / `replaceEffect` swap the function.

## Validation

A validator on `ControlOptions` re-runs on every value change and owns the `"default"`
error key:

```ts
const email = ctx.newControl("", {
  validator: (v) => (v.includes("@") ? null : "Must be an email address"),
});

email.validNow;  // false
email.errorNow;  // "Must be an email address"
```

Validators are created eagerly (children are otherwise lazy), so a nested validator runs
without anyone navigating to its control first. Errors are cleared on every value write
unless `keepErrors` is set — supply that for errors published from elsewhere (mirrored
from another control, or set by an async validator) that an unrelated write shouldn't drop.
A `validator` implies it.

## Equality

`ControlContext` owns one equality function, applied to every control it creates. The
default is `deepEquals` — a structural compare over plain objects, arrays and primitives
(with `NaN === NaN`). A write that compares equal is a no-op and notifies nobody, which
is what makes derived writes converge.

```ts
const ctx = createControlContext({ equals: Object.is });
```

Per-control equality is deliberately not supported.

## API

```ts
// Factory
createControlContext(options?: ControlContextOptions): ControlContext
deepEquals(a, b): boolean
untrackedRead: ReadContext

// Computations
computeInto(ctx, target, compute): ComputedHandle
effect(ctx, fn): EffectHandle

// Utilities
lookupControl(control, path)            // navigate by ["address", "lines", 0]
getControlPath(control, untilParent?)   // the inverse
getElementPosition(child, parent?)      // { index, initialIndex }
ensureMetaValue(control, key, init)     // lazily initialise control.meta[key]
asControl<V2>(control)                  // type-level cast
controlFromValue(v)                     // recover a control from a tracked-value proxy

// Group controls
createControlGroup(ctx, fields)         // assemble a control from existing ones
attachFields(wc, group, fields)         // the mutating counterpart
```

`createControlGroup` **attaches** rather than copies: each child becomes the group's field
for its key while keeping any parents it already had, and changes flow both ways. That is
how an ad-hoc form is assembled from independently owned controls.

### `@rx-controls/core/internal`

A second entry point exposing `ControlImpl`, `TrackingReadContext`,
`SubscriptionReconciler`, `WriteContextImpl` and friends. It exists for sibling packages
that host a reactive scope of their own — `@rx-controls/react` and the compat layer.
**It is not public API and has no stability guarantee.** If you find yourself needing it,
please open an issue describing the use case.

## Stability

1.0.0, semantic versioning: breaking changes to the public surface land in a major
release. The tree's behaviour — value propagation, error handling,
dirty/touched/disabled cascading, element lifecycle and null materialisation — is
specified in
[CONTROL-SEMANTICS.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/CONTROL-SEMANTICS.md)
and is settled.

The `@rx-controls/core/internal` subpath is explicitly outside that guarantee — see above.

ESM only. Requires a runtime with ES2022 support.

## Documentation

- [CONTROL-SEMANTICS.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/CONTROL-SEMANTICS.md) — the authoritative reference for tree behaviour
- [FUTURE-API-DESIGN.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/FUTURE-API-DESIGN.md) — why reads and writes are explicit (historical record; names have moved)
- [MIGRATION-FROM-LEGACY-CORE.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/MIGRATION-FROM-LEGACY-CORE.md) — porting from `@react-typed-forms/core`

## License

ISC © Astrolabe Enterprises
