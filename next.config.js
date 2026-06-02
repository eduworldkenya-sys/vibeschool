/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  swcMinify: false,
  experimental: {
    forceSwcTransforms: false,
  },
  webpack: (config, { defaultLoaders }) => {
    config.resolve.fallback = { fs: false };
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: [defaultLoaders.babel],
    });
    return config;
  },
};

module.exports = nextConfig;
