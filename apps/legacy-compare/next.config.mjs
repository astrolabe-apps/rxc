/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    swcPlugins: [["@astroapps/swc-controls-plugin", {}]],
  },
  // See apps/legacy-demos/next.config.mjs — Next 15 lints during `next build`,
  // the warning becomes a non-zero Rush exit, and `rush lint` covers this app
  // already.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
