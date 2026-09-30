import { serveAsset } from "../../assets";

/** The Fire form's `/tfs/…` images — see `assets.ts`. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return serveAsset(["tfs", ...(await params).path]);
}
