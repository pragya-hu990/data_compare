/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ensure all routes are accessible
  async rewrites() {
    return [];
  },
};

export default nextConfig;

