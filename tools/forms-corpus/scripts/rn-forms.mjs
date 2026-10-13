// Which forms the ServiceTas React Native app draws: the `formType="…"` it names in its screens and
// components. Writes sidecar/rn-forms.json (committed), the list the device comparison is scoped to.
//
//   node scripts/rn-forms.mjs [path/to/ServiceTasAPI/NewClientApp]
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] ?? join(process.env.HOME, "astrolabe/ServiceTas/ServiceTasAPI/NewClientApp");
const dirs = ["app", "components", "hooks", "utils"].map((d) => join(root, "servicetas-rn", d));

const found = new Set();
const walk = (p) => {
  for (const e of readdirSync(p)) {
    if (e === "node_modules") continue;
    const f = join(p, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (/\.(tsx?|jsx?)$/.test(e))
      for (const m of readFileSync(f, "utf8").matchAll(/formType=\{?"([A-Za-z]+)"/g)) found.add(m[1]);
  }
};
for (const d of dirs) walk(d);
const list = [...found].sort();
writeFileSync(join(here, "../sidecar/rn-forms.json"), JSON.stringify(list, null, 1) + "\n");
console.log(`${list.length} forms: sidecar/rn-forms.json`);
