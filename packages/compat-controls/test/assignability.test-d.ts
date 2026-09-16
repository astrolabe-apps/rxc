/**
 * Type-level pin for the compat ↔ core `Control` relationship.
 *
 * A compat `Control<V>` must stay assignable to a core `Control<V>` — that is
 * what lets a legacy app on this package hand its controls straight to
 * `@rx-controls/react` hooks and `@rx-controls/forms` while it migrates.
 * Nothing in the runtime suite catches a regression here, and the failure
 * mode is not local: because `fields` / `elementsNow` / `existingFields`
 * recurse back into `Control`, one mismatched member (historically
 * `subscribe`'s listener arity) breaks the relation for the whole type.
 *
 * This file has no runtime half — it is never executed, and vitest's
 * `test/**\/*.test.{ts,tsx}` glob deliberately excludes it. The gate is
 * `tsc -p tsconfig.typecheck.json`, which `rushx build` runs after the
 * emit pass.
 */

import type {
  Control as CoreControl,
  ReadContext,
  WriteContext,
} from "@rx-controls/core";
import { ControlChange, asCore, asLegacy } from "../src/index";
import type {
  ChangeListenerFunc,
  Control as CompatControl,
} from "../src/index";

interface Person {
  name: string;
  age: number;
  tags: string[];
  address: { street: string };
}

declare const person: CompatControl<Person>;
declare const core: CoreControl<Person>;
declare const listener: ChangeListenerFunc<Person>;
declare const rc: ReadContext;
declare const wc: WriteContext;

/** Asserts `T` is assignable to `Expected`, without widening at the call. */
function assignable<Expected>(_v: Expected): void {}

// ── compat Control → core Control ────────────────────────────────────
// Top level, and every recursive step: named field, nested compound,
// and array element.
assignable<CoreControl<Person>>(person);
assignable<CoreControl<string>>(person.fields.name);
assignable<CoreControl<{ street: string }>>(person.fields.address);
assignable<CoreControl<string>>(person.fields.address.fields.street);
assignable<CoreControl<string[]>>(person.fields.tags);
assignable<CoreControl<string>>(person.fields.tags.elements[0]);

// Accepted in core ReadContext / WriteContext positions.
assignable<Person>(rc.getValue(person));
assignable<CoreControl<string>[]>(rc.getElements(person.fields.tags));
wc.setValue(person.fields.name, "Ada");
wc.addElement(person.fields.tags, "pioneer");
wc.setTouched(person, true);

// Holds for an unresolved type parameter too — this is the strongest form,
// and it is what lets `asCore` be a plain return rather than a cast.
function widen<V>(c: CompatControl<V>): CoreControl<V> {
  return c;
}
assignable<CoreControl<Person>>(widen(person));

// ── subscribe still accepts legacy two-argument listeners ────────────
person.subscribe(() => {}, ControlChange.Value);
person.subscribe((c) => assignable<CompatControl<Person>>(c), ControlChange.Value);
person.subscribe((c, change) => assignable<ControlChange>(change), ControlChange.All);
person.subscribe((c, change, w) => assignable<WriteContext>(w), ControlChange.All);
person.subscribe(listener, ControlChange.Value);

// ── core Control → compat Control ────────────────────────────────────
// Cannot hold structurally — core declares none of the legacy members.
// @ts-expect-error
assignable<CompatControl<Person>>(core);
// `asLegacy` is the cast for it; sound at runtime because the prototype
// patch gives every control in the process both surfaces.
assignable<CompatControl<Person>>(asLegacy(core));
assignable<CoreControl<Person>>(asCore(person));
