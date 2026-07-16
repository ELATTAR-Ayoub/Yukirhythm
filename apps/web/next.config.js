/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  eslint: {
    dirs: [
      "app",
      "pages",
      "components",
      "lib",
      "context",
      "config",
      "constants",
      "sections",
      "store",
      "__tests__",
    ],
  },
};

module.exports = nextConfig;
