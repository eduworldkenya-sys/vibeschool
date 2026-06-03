/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  swcMinify: false,
  staticPageGenerationTimeout: 180,
};

module.exports = nextConfig;
