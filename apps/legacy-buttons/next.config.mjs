import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// `@react-typed-forms/core@4.x` ships an `exports` map where `default`
// appears before `require`, which webpack 5 rejects with "Default
// condition should be last one". The same broken `exports` blocks
// Node's resolver from loading any subpath (including ./package.json),
// so we read the manifest directly off the resolved symlink path and
// alias the bare specifier to its real ESM entry on disk — webpack
// then bypasses the broken field entirely.
const coreDir = realpathSync(
  join(__dirname, "node_modules/@react-typed-forms/core"),
);
const coreManifest = JSON.parse(
  readFileSync(join(coreDir, "package.json"), "utf8"),
);
const coreEntry = join(coreDir, coreManifest.module ?? coreManifest.main);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-typed-forms/core$": coreEntry,
    };
    return config;
  },
};

export default nextConfig;
