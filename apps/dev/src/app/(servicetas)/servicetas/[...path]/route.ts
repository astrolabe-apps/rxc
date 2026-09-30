import { serveAsset } from "../../assets";

/** `/servicetas/css/bootstrap.min.css` and friends — see `assets.ts`. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return serveAsset((await params).path);
}
