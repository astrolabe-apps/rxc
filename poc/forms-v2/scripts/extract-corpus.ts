/**
 * Pull a form corpus out of a legacy app into `corpus/<name>/<Form>.json`,
 * each `{ controls, fields }` — the shape the form editor writes and the
 * burndown reads — with the schema the app actually renders the form against.
 *
 *   rushx extract-corpus <name> <src-dir>
 *
 * `<src-dir>` holds `schemas.ts`, a pairing file (`formDefs.ts`, `formdefs.ts`
 * or `forms.ts`) and a `formDefs/` or `forms/` directory of JSON; the nearest
 * `node_modules` above it supplies `tsc` and package resolution.
 *
 * The app keeps its schemas in a generated `schemas.ts` (`buildSchema<T>(…)`
 * calls, which return `SchemaField[]`) and pairs each form with one in the
 * pairing file. Neither is JSON, so: compile `schemas.ts` to CommonJS with the
 * app's own `tsc` into its own `node_modules/.cache` (so `./client` and
 * `@react-typed-forms/schemas` resolve from there), `require` it, and read the
 * pairing out textually — `schema: XSchema` next to `controls: YJson.controls`
 * — rather than compiling a file that imports JSON with attributes Node would
 * reject. JSON the pairing file never mentions is written with only the
 * fields it carries itself.
 *
 * Output is derived data from another repository and is gitignored; re-run to
 * refresh.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";

const [name, srcDir] = process.argv.slice(2);
if (!name || !srcDir) {
  console.error("usage: extract-corpus <name> <src-dir>");
  process.exit(2);
}
const app = resolve(srcDir);
const schemasTs = join(app, "schemas.ts");
const pairingTs = ["formDefs.ts", "formdefs.ts", "forms.ts"]
  .map((f) => join(app, f))
  .find(existsSync);
if (!existsSync(schemasTs) || !pairingTs) {
  console.error(`need schemas.ts and a pairing file in ${app}`);
  process.exit(2);
}
let modulesDir = app;
while (!existsSync(join(modulesDir, "node_modules", ".bin", "tsc"))) {
  const up = dirname(modulesDir);
  if (up === modulesDir) {
    console.error(`no node_modules/.bin/tsc above ${app}`);
    process.exit(2);
  }
  modulesDir = up;
}

// 1. schemas.ts → CommonJS, inside the app's node_modules so its imports
//    resolve there.
const cache = join(modulesDir, "node_modules", ".cache", "rxc-corpus");
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
execFileSync(
  join(modulesDir, "node_modules", ".bin", "tsc"),
  [
    schemasTs,
    "--outDir",
    cache,
    "--rootDir",
    app,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "es2020",
    "--esModuleInterop",
    "--skipLibCheck",
    "--resolveJsonModule",
    "--noEmitOnError",
    "false",
  ],
  { stdio: "pipe" },
);
const require = createRequire(join(cache, "package.json"));
const schemas = require(join(cache, "schemas.js")) as Record<string, unknown>;

// 2. The pairing file: which JSON, which schema.
const defs = readFileSync(pairingTs, "utf8");
const jsonVars = new Map<string, string>(); // import var → path under src
let jsonDir = "formDefs";
for (const m of defs.matchAll(
  /import\s+(\w+)\s+from\s+"\.\/(formDefs|forms)\/([^"]+)"/g,
)) {
  jsonDir = m[2];
  jsonVars.set(m[1], join(m[2], m[3]));
}
interface Pairing {
  form: string;
  file: string;
  schemaVar?: string;
}
const pairings: Pairing[] = [];
for (const m of defs.matchAll(/export const (\w+)[^=]*= \{([\s\S]*?)\n\};/g)) {
  const body = m[2];
  const c = /controls:\s*(\w+)\.controls/.exec(body);
  const file = c && jsonVars.get(c[1]);
  if (!file) continue;
  const s = /schema:\s*(\w+)/.exec(body);
  pairings.push({ form: m[1], file, schemaVar: s?.[1] });
}

// 3. Write the corpus.
const out = resolve("corpus", name);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let withSchema = 0;
const missing: string[] = [];
type Field = { field: string };
for (const p of pairings) {
  const json = JSON.parse(readFileSync(join(app, p.file), "utf8"));
  const schema = p.schemaVar
    ? (schemas[p.schemaVar] as Field[] | undefined)
    : undefined;
  if (Array.isArray(schema)) withSchema++;
  else missing.push(`${p.form} (${p.schemaVar ?? "no schema:"})`);
  // The app appends the form's own `fields` to the schema; mirror that,
  // schema first so a form-local duplicate does not shadow the real field.
  const own = (json.fields ?? []) as Field[];
  const names = new Set((schema ?? []).map((f) => f.field));
  const fields = [...(schema ?? []), ...own.filter((f) => !names.has(f.field))];
  writeFileSync(
    join(out, `${p.form}.json`),
    JSON.stringify(
      { controls: json.controls, fields, source: p.file, schema: p.schemaVar },
      null,
      1,
    ),
  );
}
// JSON the pairing file never mentions still belongs to the corpus — with
// only the fields it carries itself.
const paired = new Set(pairings.map((p) => basename(p.file)));
const unpaired = readdirSync(join(app, jsonDir)).filter(
  (f) => f.endsWith(".json") && !paired.has(f),
);
for (const f of unpaired) {
  const json = JSON.parse(readFileSync(join(app, jsonDir, f), "utf8"));
  if (!Array.isArray(json.controls)) continue;
  writeFileSync(
    join(out, f),
    JSON.stringify(
      { controls: json.controls, fields: json.fields ?? [], source: f },
      null,
      1,
    ),
  );
}
console.log(
  `${pairings.length + unpaired.length} forms → ${out} ` +
    `(${withSchema} with a schema via ${basename(pairingTs)}, ${unpaired.length} unpaired, own fields only)`,
);
if (missing.length)
  console.log("no schema resolved for: " + missing.join(", "));
if (unpaired.length) console.log("unpaired: " + unpaired.join(", "));
