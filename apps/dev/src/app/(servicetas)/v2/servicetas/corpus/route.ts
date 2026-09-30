import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The ServiceTas corpus, read from `tools/forms-corpus/corpus` at request
 * time. It is another repository's forms and schemas and is gitignored, so
 * it is never bundled: absent — in CI, or before `rushx extract-corpus` —
 * this answers an empty list and the page says how to get one.
 */
export const dynamic = "force-dynamic";

const dir = path.resolve(process.cwd(), "../../tools/forms-corpus/corpus/servicetas");

export async function GET() {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return Response.json([]);
  }
  const forms = await Promise.all(
    names.map(async (f) => ({
      name: f.replace(/\.json$/, ""),
      file: JSON.parse(await readFile(path.join(dir, f), "utf8")),
    })),
  );
  return Response.json(forms);
}
