# Forms v2 — goals

The goal statement. Get this right first; the shape follows.
Implementation sketch: [`FORMS-V2-SKETCH.md`](./FORMS-V2-SKETCH.md).

## Goals

1. **JSON compatibility** — existing `ControlDefinition` / `SchemaField` JSON, as emitted by
   `Astrolabe.Schemas`, loads and renders unchanged.
2. **JSX authoring** — a form can be written as ordinary, type-safe React JSX rather than as
   a JSON definition, and gets the **same engine**: reactive control tree, validation, and
   the visible/disabled/readonly cascades. A different authoring surface, not a different
   system.
3. **Platform independence** — the same form source renders on HTML and React Native, for
   the **built-in renderer set**. A host's custom renderer may be platform-specific.
4. **Implementation independence** — no renderer implementation is baked into form source;
   Tailwind HTML, MUI, RN Paper, or a host's own design system are swapped at the root.
5. **Visual designer** — a designer edits the same JSON format and previews forms live,
   against **any web implementation**. It is **reimplemented** against the new renderers,
   not carried over. Web-only: it consumes goals 1/4/5 but not goal 3.
6. **JSON and JSX interoperate** — a JSX form can embed a designer-built JSON section, and a
   JSON form can dispatch to a hand-written component.

## Open decisions — pick up here

Nothing below is settled. In rough order of how much else depends on it:

1. **What carries the visible/disabled cascade in a JSX form?** `<Show for={…}>` vs
   re-deriving from the data tree vs opting out. Everything in goal 2 sits on this.
2. **How does a host extend `FormRenderers` with its own keys and keep type safety?**
   Module augmentation vs a generic threaded through every dispatch component.
3. **Does `FormStateNode` survive the `FormField` / `FormNode` split**, or is the cascade
   rebuilt around the binding?
4. **Design mode and portals** — a dialog renderer's content escapes the selection wrapper.
5. **Runtime-fetched `styleClass`** — safelist, named theme slots, or ship CSS with the form.
6. **One Tailwind implementation for both platforms (needs NativeWind v5, an RC), or
   separate `forms-html` / `forms-native`?** The second sidesteps the pre-release entirely.

## Consequences worth deciding early

**From goal 3 being scoped to the built-in set:** the neutral prop contract only has to be
neutral for built-in renderers. A host needing MUI `variant` or `<input type="tel">` writes
a platform-specific renderer instead of widening the contract for everyone — which
substantially relieves the pressure on the contract's design. In exchange, a form that uses
a platform-specific custom renderer is not portable, and dispatch has to fail visibly on
the other platform rather than silently render nothing.

**From goal 5 previewing *any* web implementation:** design mode cannot be something a
renderer author has to implement — a third-party MUI set will not have thought about it.
So design mode has to live in the **dispatch layer**, above renderers, which looks
achievable for all three of its behaviours:

- *render hidden fields anyway* — visibility is decided by the cascade before dispatch;
- *stub actions* — the handler is a prop, substituted before dispatch;
- *selection chrome* — a wrapper element with an absolutely-positioned overlay around
  whatever the renderer emitted. This is the one that genuinely needs web, and is the
  strongest reason the web-only restriction is worth keeping.

The residual cost is real but narrower: `ControlDefinition` / `SchemaField` must be exposed
as live reactive values, since the designer edits them in place (the `trackedValue`
adaptation listed under "Open for redesign" in `CLAUDE.md`).

**From goal 2 including the engine:** validators come off the `SchemaField`, so a JSX form
inherits `Length` / `Date` / `required` from `buildSchema` for free, and ad-hoc TS
validators need an attachment point on the binding.

The cascade is the sharp part. In JSON, `visible` is a property of a definition node and
children inherit it — and hidden nodes get `validationEnabled = false` plus `clearHidden`.
In JSX there is no definition tree: `<Show when={…}>` merely declines to render children,
which hides them visually but leaves the engine believing they are live. A required field
inside a collapsed `<Show>` would keep the form invalid with nothing on screen to fix.

So something has to carry the cascade. Three candidates, worth choosing deliberately:
  - `<Show>` takes an explicit subtree — `<Show when={x} for={f.$.petDetails}>` — and writes
    `visible` onto that `FormField`, letting the existing cascade run;
  - the cascade is re-derived from the data/schema tree rather than a definition tree;
  - JSX forms opt out of `clearHidden` / validation-suppression and the author handles it.

The first keeps one engine and one set of semantics, at the cost of a slightly redundant
prop. Currently leaning that way.

**From goal 6:** the two directions cost very different amounts.

*JSON inside JSX* is the expensive one. It is not two forms glued together — validity,
visibility, disabled and touched have to cascade across the seam in both directions, so
they must be **one cascade tree**. Concretely: `FormNode` construction has to be rootable at
an arbitrary `FormField`, not only at a form root. And the seam is **untyped** —
`f.$.address` is `FormField<Address>` but the JSON's `field: "a/b"` paths are strings, so
the match is checked at runtime, not by the compiler.

*JSX inside JSON* is cheap — it is a registry entry for a custom render type, which the
design already has. The one addition it forces: a hand-written renderer handed a `FormNode`
needs to reach typed `FormField`s for its children, so the cursor must accept string paths
as well as typed navigation.

Goal 6 also narrows an earlier claim: hand-written forms avoid the expression engine
(`$scripts`, jsonata, `EntityExpression`) **only until they embed a JSON section**.

## Assumed, not stated — confirm or cut

- **JSX forms need no round-trip to JSON.** They are not editable in the designer. The
  alternative — compiling a restricted JSX subset back to JSON — is a much larger project.

## Explicit non-goals — confirm

- **Migration path from `@rx-controls/forms`.** "Totally new implementation" reads as a
  clean break, with the existing renderer set left in place. Say so if not.
- **Legacy `@react-typed-forms/schemas` compatibility.** Handled by the compat engine
  (`packages/compat-controls`); out of scope here.
