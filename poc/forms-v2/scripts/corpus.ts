/**
 * Reading the corpus — shared by the burndown and the parity run.
 *
 * A form file is either `{ controls, fields }` (what the form editor writes)
 * or a bare `ControlDefinition[]` with no schema.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ControlDefinition, SchemaField } from "../src/loader/json.js";

export interface FormFile {
  path: string;
  controls: ControlDefinition[];
  fields: SchemaField[];
}

export function* walkFiles(p: string): Generator<string> {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      yield* walkFiles(join(p, e));
    }
  } else if (p.endsWith(".json")) yield p;
}

export function loadForm(path: string): FormFile | undefined {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (Array.isArray(raw))
    return { path, controls: raw as ControlDefinition[], fields: [] };
  if (raw && typeof raw === "object" && Array.isArray((raw as any).controls))
    return {
      path,
      controls: (raw as any).controls as ControlDefinition[],
      fields: ((raw as any).fields ?? []) as SchemaField[],
    };
  return undefined;
}

export function countControls(defs: ControlDefinition[]): number {
  return defs.reduce((n, d) => n + 1 + countControls(d.children ?? []), 0);
}
