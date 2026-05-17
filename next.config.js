/** @type {import('next').NextConfig} */
const nextConfig = {

  // COMPRESSION — cuts payload 60-70%
  compress: true,

  // IMAGE OPTIMISATION
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: '**.gutenberg.org' },
      { protocol: 'https', hostname: '**.wikipedia.org' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },

  // SMALLER PRODUCTION BUNDLE
  productionBrowserSourceMaps: false,

}

module.exports = nextConfig
