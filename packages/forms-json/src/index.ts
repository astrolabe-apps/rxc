/**
 * The Forms v2 JSON loader. It turns a `ControlDefinition` tree and its
 * `SchemaField`s into the same JSX a hand-written form would be, and returns a
 * list of everything it could not carry across rather than logging it.
 *
 * - **Loading** — translating a form, and what comes back.
 * - **Hosts** — extending the loader: translators for render types, group
 *   kinds, adornments and custom displays; icons; action handlers.
 *
 * @packageDocumentation
 */

export * from "./loader.js";
export * from "./translator.js";
