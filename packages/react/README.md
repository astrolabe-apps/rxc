# @rx-controls/react

React bindings for [`@rx-controls/core`](https://www.npmjs.com/package/@rx-controls/core) —
a reactive control tree for form and application state.

Re-exports all of `@rx-controls/core`, so this is the only import you need.

```bash
npm install @rx-controls/react
```

Peer dependency: React 18 or 19.

## What's different

Most reactive React libraries track dependencies ambiently: a global collector is set
during render, property reads report to it, and the component that happens to be rendering
gets subscribed. That works, but it needs a compiler plugin or an HOC to install the
collector, and it is unsafe under concurrent rendering.

Here the read scope is **an explicit value you thread**. `useReactive()` hands your
component a `ReadContext` (`rc`); you read through it; and you close the render pass with
`rendered(…)`, which turns everything you read into live subscriptions. No plugin, no HOC,
no globals — and the component that re-renders is exactly the one that did the reading.

The cost is one call at each `return`. The type system enforces it.

## Setup

Provide a `ControlContext` once, at the root:

```tsx
import { ControlContextProvider, createControlContext } from "@rx-controls/react";

const controlContext = createControlContext();

export function App({ children }) {
  return (
    <ControlContextProvider value={controlContext}>
      {children}
    </ControlContextProvider>
  );
}
```

One per app — or one per SSR request, which is what makes `uniqueId` sequences reproducible
across render and hydration. There is deliberately no implicit fallback: a missing provider
throws rather than silently giving you a second runtime.

## A component

```tsx
import { useControl, useReactive, type Rendered } from "@rx-controls/react";
import type { Control } from "@rx-controls/react";

function TextInput({ control, label }: {
  control: Control<string>;
  label: string;
}): Rendered {
  const { rc, rendered, update } = useReactive();

  const value = rc.getValue(control);
  const touched = rc.isTouched(control);
  const error = rc.getError(control);

  return rendered(
    <label>
      {label}
      <input
        value={value}
        onChange={(e) => update((wc) => wc.setValue(control, e.target.value))}
        onBlur={() => update((wc) => wc.setTouched(control, true, true))}
      />
      {touched && error && <span className="error">{error}</span>}
    </label>,
  );
}

function SignupForm(): Rendered {
  const { rc, rendered } = useReactive();

  const form = useControl(
    { email: "", password: "" },
    { fields: { email: { validator: (v) => (v.includes("@") ? null : "Invalid email") } } },
  );

  return rendered(
    <form>
      <TextInput control={form.fields.email} label="Email" />
      <TextInput control={form.fields.password} label="Password" />
      <button disabled={!rc.isValid(form)}>Sign up</button>
    </form>,
  );
}
```

Typing in the email field re-renders `TextInput` alone. `SignupForm` re-renders only when
validity flips, because that is the only facet it read.

## The render boundary

Two rules. Both are covered in full by
[RENDER-BOUNDARY.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/RENDER-BOUNDARY.md).

**1. Every return path goes through `rendered(…)`** — early returns included.

```tsx
function View({ data }: { data: Control<Item | null> }): Rendered {
  const { rc, rendered } = useReactive();
  const item = rc.getValue(data);
  if (!item) return rendered(null);        // ← not `return null`
  return rendered(<div>{item.name}</div>);
}
```

Annotating the return type as `Rendered` makes forgetting a **compile error**: only
`rendered()` can produce that type, so raw JSX won't satisfy it. A dev-mode warning covers
what the type can't reach (test files, anything outside your `tsconfig` include). Skip the
boundary and your reads are tracked but never subscribed — the component silently stops
updating.

**2. Use the `rc` you were handed**, never one closed over from an enclosing component. A
stale `rc` doesn't throw: it returns the current value and registers nothing. The render
helpers below hand each callback its own `rc` — name the parameter `rc` so it shadows the
outer one, and the mistake becomes a scoping impossibility. A dev guard catches the common
shape and logs the offending component once per call site.

### Writing during render

`update` is callable from the render body — the "adjust derived state while rendering"
shape, React's guarded render-phase `setState`. The write applies immediately, so the rest
of your body and every descendant yet to render sees it; notification to already-committed
components is deferred out of the render phase for you.

The write must converge. Derived values do so on their own, because `setValue` bails on the
context's `equals` before touching a subscription. A value that genuinely differs every pass
(a counter, `Date.now()`) loops, and React reports "Too many re-renders" — the same
diagnostic plain React gives.

## Hooks

| Hook | |
|---|---|
| `useReactive()` | `{ rc, rendered, update }` — the render boundary |
| `useControl(initial?, options?)` | Create a control scoped to the component. Stable identity; lazy initialiser supported |
| `useComputed(compute)` | A `Control<V>` holding a derived value. Re-renders only when the *result* moves |
| `useControlEffect(compute, onChange, initial?)` | Run `onChange` when the computed value changes. Does not re-render |
| `useValidator(control, validate, key?)` | Publish a validation error under `key`. Cross-field reads via its `rc` |
| `useAsyncValidator(control, validate, delay, check?)` | Debounced async validation with abort-on-supersede |
| `useControlGroup(fields, deps?)` | Assemble one control from existing ones, two-way bound |
| `useValueWithPrevious(control)` | `Control<{ previous?, current }>` |
| `useSelectableArray(control, builder?, …)` | An array as `{ selected, value }` entries; `selectableValues(values, key)` builds the standard one |
| `useControlContext()` | The ambient `ControlContext` — for `newControl` outside a render |
| `useFormEdit()` / `FormEditProvider` | Cascading `readOnly` / `disabled` presentation state |

`useControlEffect` fires when the computed value changes per the tree's equality, once,
with the latest value. An inline `compute` is re-run each render so it sees moved props;
wrap it in `useCallback` to opt out.

## Render helpers

Each opens a **nested subscription scope**, so reads inside re-render that boundary alone
rather than the calling component.

```tsx
<Reactive>{(rc) => <span>{rc.getValue(count)}</span>}</Reactive>

<RenderElements control={items} empty={<p>Nothing yet</p>}>
  {(rc, item, index) => <Row key={index} control={item} />}
</RenderElements>

<RenderOptional control={maybeUser} notDefined={<Spinner />}>
  {(rc, user) => <Profile control={user} />}
</RenderOptional>

<RenderArrayElements array={plainItems}>
  {(item) => <li>{item.label}</li>}
</RenderArrayElements>
```

The callback returns a plain `ReactNode` — the helper owns the boundary and closes the pass
itself, so forgetting `rendered()` is impossible here.

`RenderElements` keys by `Control.uniqueId`, allocated per `ControlContext`, so the key
sequence is identical across SSR and hydration. `RenderOptional` subscribes to null-ness
alone. `whenAllDefined(controls, render, else?)` is the callback form for several controls
at once, and `NotDefinedProvider` sets the default `notDefined` fallback for a subtree.

## Bound inputs

Thin `<input>` / `<select>` / `<input type=checkbox>` wrappers, for when you don't need
custom chrome:

```tsx
<ControlInput control={form.fields.email} type="email" />
<ControlSelect control={form.fields.country}>{options}</ControlSelect>
<ControlCheckbox control={form.fields.agreed} />
```

Each opens its own render boundary, so typing re-renders the input alone and never the
parent. They honour the ambient `FormEditState`, publish the control's error as HTML5
custom validity, and store the element on `control.meta.element`.

For custom inputs, `useFormControlProps(rc, control)` returns `{ props, errorText }` —
spread `props` onto your element and render `errorText` yourself.

## Stability

1.0.0, semantic versioning: breaking changes to the public surface land in a major
release. The render-boundary contract and the underlying tree semantics are settled —
see
[RENDER-BOUNDARY.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/RENDER-BOUNDARY.md)
and
[CONTROL-SEMANTICS.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/CONTROL-SEMANTICS.md).

ESM only. React 18.0+ (the floor is `useId`); verified against 18.3.1 and 19.

## Coming from `@react-typed-forms/core`?

Two routes, and you can take them in either order:

- **Keep your code as it is.** `@react-typed-forms/core@5` is the same API reimplemented on
  this engine — a semver bump plus one provider line at your root. Controls pass between the
  two packages without a cast, so you can migrate component by component afterwards.
- **Port directly.** [MIGRATION-FROM-LEGACY-CORE.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/MIGRATION-FROM-LEGACY-CORE.md)
  maps every read, write, hook and component to its equivalent here, for both v4 and v5.

## Documentation

- [RENDER-BOUNDARY.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/RENDER-BOUNDARY.md) — the `useReactive` / `rendered` contract in full
- [CONTROL-SEMANTICS.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/CONTROL-SEMANTICS.md) — control tree behaviour
- [MIGRATION-FROM-LEGACY-CORE.md](https://github.com/astrolabe-apps/rxc/blob/main/docs/MIGRATION-FROM-LEGACY-CORE.md) — porting from `@react-typed-forms/core`

## License

ISC © Astrolabe Enterprises
