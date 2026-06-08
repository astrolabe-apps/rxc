/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    swcPlugins: [["@astroapps/swc-controls-plugin", {}]],
  },
};

export default nextConfig;
