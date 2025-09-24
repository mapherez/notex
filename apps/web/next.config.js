/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable transpilation of packages in the monorepo
  transpilePackages: ['@notex/ui', '@notex/utils', '@notex/config'],
  // PWA and performance optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;