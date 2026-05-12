/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    swcPlugins: [["@astroapps/swc-controls-plugin", {}]],
  },
};

export default nextConfig;
