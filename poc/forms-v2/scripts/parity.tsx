/**
 * The second instrument: semantic parity against legacy.
 *
 * The burndown (`burndown.ts`) measures shape coverage — did something claim
 * this discriminator, read this property, pass on what was built. It cannot
 * see a translation that reads everything and computes the wrong answer
 * (README finding 62 found 296 of those only because their properties went
 * *unread*). This script can: it runs every corpus form twice over the same
 * fixture data — once through legacy's own form-state tree and once through
 * the v2 loader mounted under React — lets both settle, and diffs what each
 * left in the data and
 * what each published as errors, path by path.
 *
 * The legacy side is the real thing — `@react-typed-forms/schemas` (v19),
 * whose form-state tree `createFormStateNode` builds headlessly, exactly as
 * its own renderer does inside a `useMemo`. Those versions run on
 * `@react-typed-forms/core@5`, the compat package over `@rx-controls/core`,
 * and in this workspace that resolves to the local packages: both sides run
 * on the same engine copy, so one `untrackedRead` walker reads both. Values catch
 * `clearHidden`, `defaultValue` and every write a translation makes; errors
 * catch `required`, validators and their `hidden` gating. Visibility is not
 * read directly — v2 has no node tree to ask — but with `clearHidden` on in
 * both, a wrongly-shown or wrongly-hidden field with a value becomes a value
 * difference, which is why the "filled" fixture exists. Two divergences are
 * classified rather than counted — v2's write-free display-only boundary
 * (finding 54) and legacy's one shared `jsonata` error key (finding 69) —
 * and the summary names each with its count; `--show` still prints them.
 *
 *   rushx parity [<dir-or-file>...]         summary; default ./corpus
 *   rushx parity --show <form-basename>     every difference in one form
 *   rushx parity --fixture empty|filled     one fixture only (default both)
 *   rushx parity --show <form> --trace <f>   legacy's visibility for controls whose field contains <f>
 */
import { relative } from "node:path";
import { existsSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Window } from "happy-dom";
import {
  createControlContext,
  untrackedRead,
  type Control,
} from "@rx-controls/core";
import { ControlContextProvider } from "@rx-controls/react";
import { newControl } from "@react-typed-forms/core";
import {
  createFormStateNode,
  createFormTree,
  createSchemaDataNode,
  createSchemaTree,
  defaultEvaluators,
  defaultResolveChildNodes,
  defaultSchemaInterface,
  type FormStateNode,
} from "@react-typed-forms/schemas";
import { Form, FormProvider } from "../src/framework/index.js";
import { htmlRenderers } from "../src/impls/html.js";
import { JsonForm } from "../src/loader/JsonForm.js";
import type { SchemaField } from "../src/loader/json.js";
import { countControls, loadForm, walkFiles, type FormFile } from "./corpus.js";

const rd = untrackedRead;

// ── a DOM for React to mount into ─────────────────────────────────────
const win = new Window({ url: "http://localhost/" });
{
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  for (const k of [
    "document",
    "navigator",
    "location",
    "history",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "matchMedia",
    "Node",
    "Element",
    "HTMLElement",
    "SVGElement",
    "Text",
    "Comment",
    "DocumentFragment",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "InputEvent",
    "MutationObserver",
    "ResizeObserver",
    "IntersectionObserver",
    "HTMLInputElement",
    "HTMLTextAreaElement",
    "HTMLSelectElement",
    "HTMLButtonElement",
    "HTMLFormElement",
    "HTMLDialogElement",
    "CSSStyleDeclaration",
    "DOMParser",
  ])
    if (g[k] === undefined)
      g[k] = (win as unknown as Record<string, unknown>)[k];
}

// ── args ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const showAt = args.indexOf("--show");
const show = showAt >= 0 ? args[showAt + 1] : undefined;
const traceAt = args.indexOf("--trace");
const trace = traceAt >= 0 ? args[traceAt + 1] : undefined;
const fxAt = args.indexOf("--fixture");
const onlyFixture = fxAt >= 0 ? args[fxAt + 1] : undefined;
const skip = new Set([showAt + 1, fxAt + 1, traceAt + 1]);
let roots = args.filter((a, i) => !a.startsWith("--") && !skip.has(i));
if (roots.length === 0 && existsSync("corpus")) roots = ["corpus"];
if (roots.length === 0) {
  console.error(
    "usage: parity [--show <form>] [--fixture empty|filled] <dir-or-file>...",
  );
  process.exit(2);
}

// ── fixtures ──────────────────────────────────────────────────────────
type Fixture = { name: string; make(fields: SchemaField[]): unknown };

function filled(fields: SchemaField[], n = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    // UI state, not data — legacy never reads it from the value (finding 66).
    if (f.meta) continue;
    // Elements are distinct (`text1`, `text2`): identical elements make a
    // radio built from them collide on option value — a fixture artefact.
    const one = (i: number): unknown => {
      if (f.options?.length)
        return f.options[Math.min(i, f.options.length - 1)].value;
      switch (f.type) {
        case "String":
          return i ? `text${i}` : "text";
        case "Int":
          return 1 + i;
        case "Double":
          return 1.5 + i;
        case "Bool":
          return true;
        case "Date":
          return "2024-03-09";
        case "DateTime":
          return "2024-03-09T10:00:00Z";
        case "Time":
          return "10:00:00";
        case "Compound":
          return filled(f.children ?? [], i);
        default:
          return "x";
      }
    };
    out[f.field] = f.collection ? [one(1), one(2)] : one(n);
  }
  return out;
}
const fixtures: Fixture[] = [
  { name: "empty", make: () => ({}) },
  { name: "filled", make: filled },
].filter((f) => !onlyFixture || f.name === onlyFixture);

// ── snapshots: values and errors by path, off the shared engine ───────
type Snapshot = { values: Map<string, string>; errors: Map<string, string[]> };

const UNDEF = "∅";
function flatten(v: unknown, path: string, out: Map<string, string>): void {
  if (v === undefined) {
    out.set(path || ".", UNDEF);
    return;
  }
  if (v === null || typeof v !== "object") {
    out.set(path || ".", JSON.stringify(v));
    return;
  }
  if (Array.isArray(v)) {
    out.set(path || ".", `[${v.length}]`);
    v.forEach((e, i) => flatten(e, `${path}[${i}]`, out));
    return;
  }
  const keys = Object.keys(v as object);
  out.set(path || ".", `{${keys.length}}`);
  for (const k of keys)
    flatten((v as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
}

function walkErrors(
  control: Control<unknown>,
  fields: SchemaField[],
  path: string,
  out: Map<string, string[]>,
): void {
  const errs = [
    ...new Set(
      Object.values(rd.getErrors(control)).filter(Boolean) as string[],
    ),
  ].sort();
  if (errs.length) out.set(path || ".", errs);
  const value = rd.getValue(control);
  if (value === null || value === undefined || typeof value !== "object")
    return;
  const fieldsOf = (control as Control<Record<string, unknown>>).fields;
  for (const f of fields) {
    if (!fieldsOf) break;
    const child = fieldsOf[f.field] as Control<unknown> | undefined;
    if (!child) continue;
    const p = path ? `${path}.${f.field}` : f.field;
    if (f.collection) {
      const cv = rd.getValue(child);
      if (Array.isArray(cv)) {
        const errsHere = [
          ...new Set(
            Object.values(rd.getErrors(child)).filter(Boolean) as string[],
          ),
        ].sort();
        if (errsHere.length) out.set(p, errsHere);
        rd.getElements(child as Control<unknown[]>).forEach((el, i) =>
          walkErrors(el, f.children ?? [], `${p}[${i}]`, out),
        );
        continue;
      }
    }
    walkErrors(child, f.children ?? [], p, out);
  }
}

function snapshot(control: Control<unknown>, fields: SchemaField[]): Snapshot {
  const values = new Map<string, string>();
  flatten(rd.getValue(control), "", values);
  const errors = new Map<string, string[]>();
  walkErrors(control, fields, "", errors);
  return { values, errors };
}
const same = (a: Snapshot, b: Snapshot) =>
  JSON.stringify([...a.values]) === JSON.stringify([...b.values]) &&
  JSON.stringify([...a.errors]) === JSON.stringify([...b.errors]);

/** Let effects, React commits and async expressions land; stop when stable. */
async function settle(
  take: () => Snapshot,
  drain?: () => void,
): Promise<Snapshot> {
  let last = take();
  let stable = 0;
  for (let i = 0; i < 200 && stable < 4; i++) {
    drain?.();
    await new Promise((r) => setTimeout(r, 5));
    const next = take();
    stable = same(last, next) ? stable + 1 : 0;
    last = next;
  }
  return last;
}

// ── the oracle: legacy itself, headless ───────────────────────────────
async function runOracle(form: FormFile, data: unknown): Promise<Snapshot> {
  // A compat control, so legacy's ambient machinery is at home — and an
  // `@rx-controls/core` control underneath, so the shared walker reads it.
  const dataControl = newControl<unknown>(structuredClone(data));
  const schemaNode = createSchemaTree(form.fields as never).rootNode;
  const dataNode = createSchemaDataNode(schemaNode, dataControl);
  const formNode = createFormTree(form.controls as never).rootNode;
  const queue: (() => void)[] = [];
  // The globals legacy's renderer builds (schemas/lib/index.js, useControlRenderer).
  const root = createFormStateNode(
    formNode,
    dataNode,
    {
      schemaInterface: defaultSchemaInterface,
      evalExpression: (e, ctx) => defaultEvaluators[e.type]?.(e, ctx),
      resolveChildren: defaultResolveChildNodes,
      runAsync: (fn) => queue.push(fn),
      clearHidden: true,
    },
    {},
  );
  // Children are lazy; the effects that matter live on the nodes, so walk
  // the tree into existence — and again after each settle step, since a
  // visibility change can grow it.
  const materialise = (n: FormStateNode) => n.children.forEach(materialise);
  materialise(root);
  const snap = await settle(
    () => snapshot(dataControl as unknown as Control<unknown>, form.fields),
    () => {
      materialise(root);
      while (queue.length) queue.shift()!();
    },
  );
  if (trace) {
    const walk = (n: FormStateNode, depth: number) => {
      const f = (n.definition as { field?: string }).field;
      if (f && f.includes(trace)) {
        const nodeCtl = n.dataNode?.control as unknown as
          | Control<unknown>
          | undefined;
        const parentCtl = (
          n as unknown as { parent: { control: Control<unknown> } }
        ).parent?.control;
        console.log(
          `    legacy ${"  ".repeat(depth)}${f}  parentCtl#${parentCtl?.uniqueId} (root#${(dataControl as unknown as Control<unknown>).uniqueId})  visible=${String(n.visible)}  node#${nodeCtl?.uniqueId}=${JSON.stringify(nodeCtl ? rd.getValue(nodeCtl) : undefined)?.slice(0, 30)}  errors=${JSON.stringify(nodeCtl ? rd.getErrors(nodeCtl) : {})}`,
        );
      }
      n.children.forEach((c) => walk(c, depth + 1));
    };
    walk(root, 0);
  }
  root.cleanup();
  return snap;
}

// ── v2: the loader, mounted ───────────────────────────────────────────
async function runV2(form: FormFile, data: unknown): Promise<Snapshot> {
  const ctx = createControlContext();
  const dataControl = ctx.newControl<unknown>(structuredClone(data));
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as Element);
  const tree: ReactNode = createElement(ControlContextProvider, {
    value: ctx,
    children: createElement(FormProvider, {
      renderers: htmlRenderers,
      children: createElement(Form, {
        clearHidden: true,
        children: createElement(JsonForm, {
          controls: form.controls,
          schema: form.fields,
          data: dataControl,
          actionHandler: () => () => {},
        }),
      }),
    }),
  });
  root.render(tree);
  const snap = await settle(() => snapshot(dataControl, form.fields));
  root.unmount();
  container.remove();
  return snap;
}

// ── diff ──────────────────────────────────────────────────────────────
interface Diff {
  kind: "value" | "error" | "message" | "expected";
  path: string;
  legacy: string;
  v2: string;
  /** For `expected`: which known divergence claimed it. */
  why?: string;
}
const DISPLAY_ONLY = "display-only, finding 54";
const SHARED_JSONATA = "shared jsonata key, finding 69";

/**
 * The one divergence v2 chose (README finding 54): legacy's `clearHidden`
 * wiped a hidden DisplayOnly control's value; v2's display-only boundary is
 * write-free. A field bound *only* by DisplayOnly definitions that legacy
 * cleared and v2 kept is therefore expected, and reported as such rather
 * than as a parity failure. Matched by field name — the loader's path
 * resolution is not replayed here — so a name bound both ways stays real.
 */
function displayOnlyFields(form: FormFile): Set<string> {
  const only = new Map<string, boolean>();
  const walk = (cs: FormFile["controls"]) => {
    for (const c of cs) {
      if (c.type === "Data" && c.field) {
        const leaf = c.field.split("/").pop()!;
        const ro = c.renderOptions?.type === "DisplayOnly";
        only.set(leaf, (only.get(leaf) ?? true) && ro);
      }
      walk(c.children ?? []);
    }
  };
  walk(form.controls);
  return new Set([...only].filter(([, v]) => v).map(([k]) => k));
}

/**
 * The divergence legacy chose for it (README finding 69): every `Jsonata`
 * validator on a control publishes under the one `"jsonata"` error key, so
 * on a control with two the last to answer wins — and an empty answer
 * clears the other's message. v2 keys each validator (`jsonata`,
 * `jsonata1`, …). A control carrying two or more is therefore expected to
 * report an error in v2 that legacy has lost, and is reported as such.
 * Matched by field name, like `displayOnlyFields`.
 */
function sharedJsonataFields(form: FormFile): Set<string> {
  const out = new Set<string>();
  const walk = (cs: FormFile["controls"]) => {
    for (const c of cs) {
      const n = (
        (c as { validators?: { type: string }[] }).validators ?? []
      ).filter((v) => v.type === "Jsonata").length;
      if (c.type === "Data" && c.field && n >= 2)
        out.add(c.field.split("/").pop()!);
      walk(c.children ?? []);
    }
  };
  walk(form.controls);
  return out;
}

const leafOf = (p: string) =>
  p
    .replace(/\[\d+\]/g, "")
    .split(".")
    .pop()!;

function diff(a: Snapshot, b: Snapshot, form: FormFile): Diff[] {
  const displayOnly = displayOnlyFields(form);
  const sharedJsonata = sharedJsonataFields(form);
  const out: Diff[] = [];
  const paths = new Set([...a.values.keys(), ...b.values.keys()]);
  for (const p of [...paths].sort()) {
    const x = a.values.get(p),
      y = b.values.get(p);
    if (x === y) continue;
    const expected =
      x === UNDEF &&
      y !== undefined &&
      y !== UNDEF &&
      displayOnly.has(leafOf(p));
    out.push({
      kind: expected ? "expected" : "value",
      path: p,
      legacy: x ?? "(absent)",
      v2: y ?? "(absent)",
      why: expected ? DISPLAY_ONLY : undefined,
    });
  }
  const epaths = new Set([...a.errors.keys(), ...b.errors.keys()]);
  for (const p of [...epaths].sort()) {
    const x = a.errors.get(p),
      y = b.errors.get(p);
    if (!!x !== !!y) {
      const expected = !x && !!y && sharedJsonata.has(leafOf(p));
      out.push({
        kind: expected ? "expected" : "error",
        path: p,
        legacy: x?.join("; ") ?? "(none)",
        v2: y?.join("; ") ?? "(none)",
        why: expected ? SHARED_JSONATA : undefined,
      });
    }
    else if (x && y && x.join("|") !== y.join("|"))
      out.push({
        kind: "message",
        path: p,
        legacy: x.join("; "),
        v2: y.join("; "),
      });
  }
  return out;
}

// ── run ───────────────────────────────────────────────────────────────
interface Result {
  form: FormFile;
  fixture: string;
  diffs: Diff[];
  crashed?: string;
}
const results: Result[] = [];
const cwd = process.cwd();
const forms: FormFile[] = [];
for (const r of roots)
  for (const p of walkFiles(r)) {
    const f = loadForm(p);
    if (f && f.fields.length) forms.push(f);
  }

for (const form of forms) {
  const base = relative(cwd, form.path);
  if (show && !base.endsWith(show) && !base.includes(show)) continue;
  for (const fx of fixtures) {
    const data = fx.make(form.fields);
    try {
      const [legacy, v2] = [
        await runOracle(form, data),
        await runV2(form, data),
      ];
      results.push({
        form,
        fixture: fx.name,
        diffs: diff(legacy, v2, form),
      });
    } catch (e) {
      results.push({
        form,
        fixture: fx.name,
        diffs: [],
        crashed: e instanceof Error ? (e.stack ?? e.message) : String(e),
      });
    }
  }
}

const pad = (s: string | number, n: number) => String(s).padEnd(n);
if (show) {
  for (const r of results) {
    console.log(
      `\n${relative(cwd, r.form.path)} · ${r.fixture} · ${r.crashed ? "CRASHED" : `${r.diffs.length} difference(s)`}`,
    );
    if (r.crashed)
      console.log("  " + r.crashed.split("\n").slice(0, 6).join("\n  "));
    for (const d of r.diffs)
      console.log(
        `  ${pad(d.kind, 8)} ${pad(d.path, 40)} legacy ${d.legacy}   v2 ${d.v2}` +
          (d.why ? `   (${d.why})` : ""),
      );
  }
} else {
  const real = (r: Result) => r.diffs.filter((d) => d.kind !== "expected");
  const total = results.reduce((n, r) => n + real(r).length, 0);
  const expected = new Map<string, number>();
  for (const r of results)
    for (const d of r.diffs)
      if (d.kind === "expected")
        expected.set(d.why!, (expected.get(d.why!) ?? 0) + 1);
  const expectedNote = [...expected]
    .map(([why, n]) => `${n} ${why}`)
    .join("; ");
  const clean = results.filter(
    (r) => !r.crashed && real(r).length === 0,
  ).length;
  const crashed = results.filter((r) => r.crashed);
  console.log(
    `${forms.length} forms × ${fixtures.length} fixture(s), ${forms.reduce((n, f) => n + countControls(f.controls), 0)} controls — ` +
      `${clean} of ${results.length} runs identical, ${total} differences` +
      (expectedNote ? ` (+expected: ${expectedNote})` : "") +
      (crashed.length ? `, ${crashed.length} crashed` : ""),
  );
  const byKind = new Map<string, number>();
  const byLeaf = new Map<string, { n: number; forms: Set<string> }>();
  for (const r of results)
    for (const d of real(r)) {
      byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
      const leaf = `${d.kind}:${d.path
        .replace(/\[\d+\]/g, "[]")
        .split(".")
        .pop()}`;
      const e = byLeaf.get(leaf) ?? { n: 0, forms: new Set<string>() };
      e.n++;
      e.forms.add(r.form.path);
      byLeaf.set(leaf, e);
    }
  console.log("\nby kind");
  for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1]))
    console.log(`  ${pad(k, 10)} ${n}`);
  console.log("\nby path leaf (count · forms)");
  for (const [k, e] of [...byLeaf].sort((a, b) => b[1].n - a[1].n).slice(0, 25))
    console.log(`  ${pad(e.n, 5)} ${pad(e.forms.size, 4)} ${k}`);
  console.log("\nworst runs");
  for (const r of [...results]
    .sort((a, b) => real(b).length - real(a).length)
    .slice(0, 12))
    if (real(r).length)
      console.log(
        `  ${pad(real(r).length, 5)} ${pad(r.fixture, 7)} ${relative(cwd, r.form.path)}`,
      );
  if (crashed.length) {
    console.log("\ncrashed");
    for (const r of crashed)
      console.log(
        `  ${relative(cwd, r.form.path)} · ${r.fixture}: ${r.crashed!.split("\n")[0]}`,
      );
  }
}
process.exit(0);
