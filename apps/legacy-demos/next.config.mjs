/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    swcPlugins: [["@astroapps/swc-controls-plugin", {}]],
  },
  // Next 15 runs ESLint during `next build` and, with no eslint in this app's
  // devDeps, reports "ESLint must be installed" as a build warning — which
  // Rush escalates to a non-zero exit, so `rush build` fails despite every
  // project compiling. ESLint deliberately lives in the `lint` autoinstaller
  // rather than in each package (see CLAUDE.md), and `rush lint` already runs
  // `eslint packages apps` over this app, so build-time linting is redundant.
  // Next 16 dropped lint-during-build, so the Next 16 apps here need nothing.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
