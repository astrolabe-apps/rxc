import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * ServiceTas's css baseline and the Fire form's images, served from
 * `apps/legacy-compare/public` rather than copied: the side-by-side is only
 * like for like if both apps load the same files.
 */
const root = path.resolve(process.cwd(), "../legacy-compare/public");

const types: Record<string, string> = {
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export async function serveAsset(segments: string[]): Promise<Response> {
  const file = path.resolve(root, ...segments);
  if (!file.startsWith(root + path.sep))
    return new Response("Not found", { status: 404 });
  try {
    return new Response(await readFile(file), {
      headers: {
        "content-type": types[path.extname(file)] ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
