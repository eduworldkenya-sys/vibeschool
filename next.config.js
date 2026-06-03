/** @type {import('next').NextConfig} */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚠️  VIBESCHOOL BUILD SAFETY RULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NEVER add defaultLoaders.babel to webpack config
// NEVER add @next/swc-wasm-nodejs to dependencies
// NEVER commit .babelrc to this repo
// NEVER disable SWC — it handles "use client" detection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const nextConfig = {
  compress: true,
  productionBrowserSourceMaps: false,
  staticPageGenerationTimeout: 180,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
