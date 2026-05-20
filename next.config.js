/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  swcMinify: false,
  experimental: {
    forceSwcTransforms: false,
  },
  webpack: (config) => config,
}
module.exports = nextConfig
