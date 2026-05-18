/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    forceSwcTransforms: false,
  },
  swcMinify: false,
}

module.exports = nextConfig
