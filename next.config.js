/** @type {import('next').NextConfig} */
const nextConfig = {

  // 1. COMPRESSION — cuts payload 60-70%
  compress: true,

  // 2. IMAGE OPTIMISATION
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: '**.gutenberg.org' },
      { protocol: 'https', hostname: '**.wikipedia.org' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },

  // 3. CACHE HEADERS
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ]
  },

  // 4. BUNDLE OPTIMISATION
  experimental: {
    optimizePackageImports: ['@supabase/supabase-js'],
  },

  // 5. SMALLER PRODUCTION BUNDLE
  productionBrowserSourceMaps: false,

}

module.exports = nextConfig
