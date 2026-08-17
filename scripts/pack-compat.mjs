#!/usr/bin/env node
/**
 * Pack the workspace for a trial install in an external project, and emit the
 * dependency overrides a consumer of the legacy-compat stack needs.
 *
 * The packing itself is just Rush:
 *
 *   rush publish --publish --pack --include-all --release-folder <dir>
 *
 * which packs every `shouldPublish: true` project via `pnpm pack` (so
 * `workspace:*` specs are rewritten to real versions).
 *
 * The build step is scoped to those same projects rather than being a bare
 * `rush build`, which currently exits 1: the two legacy Next apps warn that
 * ESLint isn't installed, and Rush treats "succeeded with warnings" as a
 * non-zero exit. Those apps are not packed, so building `--to` each
 * publishable project skips them and keeps the build honest about what the
 * tarballs actually contain.
 *
 * What this script adds is the last step: writing an `overrides.json` for the
 * three packages a legacy `@react-typed-forms/core` consumer needs. Listing
 * the tarballs as ordinary dependencies is NOT enough — the compat tarball's
 * own manifest asks for `@rxc/controls-core@<version>`, which the package
 * manager then tries to fetch from the registry and fails on. Overrides force
 * every reference, direct and transitive, onto the local tarballs.
 *
 * That also keeps exactly ONE copy of `@rxc/controls-core` in the consuming
 * process, which the compat layer requires: `compat-controls/src/patch.ts`
 * mutates `ControlImpl.prototype`, so a second copy of the engine would leave
 * half the app's controls unpatched and break interop with migrated
 * components. See packages/compat-controls/README.md.
 *
 * Usage:
 *   node scripts/pack-compat.mjs [--out <dir>] [--no-build]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rush = path.join(repoRoot, "common/scripts/install-run-rush.js");

/** The packages a legacy `@react-typed-forms/core` consumer must override. */
const COMPAT_STACK = ["controls-core", "controls", "compat-controls"];

function parseArgs(argv) {
  const args = { out: path.join(repoRoot, "dist-tarballs"), build: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = path.resolve(argv[++i]);
    else if (argv[i] === "--no-build") args.build = false;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

const { out, build } = parseArgs(process.argv.slice(2));

function rushCmd(...cmdArgs) {
  execFileSync("node", [rush, ...cmdArgs], { cwd: repoRoot, stdio: "inherit" });
}

/** The projects `--include-all` will pack, straight from Rush. */
function publishableProjects() {
  const raw = execFileSync("node", [rush, "list", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  // `rush list` prefixes its JSON with a banner
  const { projects } = JSON.parse(raw.slice(raw.indexOf("{")));
  return projects.filter((p) => p.shouldPublish).map((p) => p.name);
}

if (build) {
  rushCmd("build", ...publishableProjects().flatMap((n) => ["--to", n]));
}

fs.rmSync(out, { recursive: true, force: true });
rushCmd(
  "publish",
  "--publish",
  "--pack",
  "--include-all",
  "--release-folder",
  out,
);

const overrides = {};
for (const pkg of COMPAT_STACK) {
  const { name, version } = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "packages", pkg, "package.json"), "utf8"),
  );
  const tarball = `${name.replace("@", "").replace("/", "-")}-${version}.tgz`;
  const abs = path.join(out, tarball);
  if (!fs.existsSync(abs)) {
    console.error(`expected ${tarball} in ${out} — did rush publish --pack run?`);
    process.exit(1);
  }
  // A packed manifest must never keep a workspace: protocol spec, or the
  // consumer's install fails on an unresolvable protocol.
  const packed = execFileSync("tar", ["-xzOf", abs, "package/package.json"], {
    encoding: "utf8",
  });
  if (packed.includes("workspace:")) {
    console.error(`${name}: packed manifest still contains a workspace: spec`);
    process.exit(1);
  }
  overrides[name] = `file:${abs}`;
}

fs.writeFileSync(
  path.join(out, "overrides.json"),
  JSON.stringify(overrides, null, 2) + "\n",
);

console.log(`\nTarballs in ${out}`);
console.log(`\nAdd to the consuming project's pnpm.overrides (or, in a Rush repo,`);
console.log(`globalOverrides in common/config/rush/pnpm-config.json):\n`);
console.log(JSON.stringify(overrides, null, 2));
console.log(`\nAlso written to ${path.join(out, "overrides.json")}`);
