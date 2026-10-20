// Vibeschool's academic day is authoritative in Kenya time.
// Set this before Next.js evaluates server-rendered date and time content so
// hydration output matches learners' Nairobi-local browser experience.
process.env.TZ = 'Africa/Nairobi'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: false,
  },
  swcMinify: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      ...['teacher', 'student', 'parent', 'admin', 'hq', 'school', 'auth'].map((area) => ({
        source: `/${area}/:path*`,
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      })),
      {
        source: '/login',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }],
      },
    ]
  },
}
module.exports = nextConfig
