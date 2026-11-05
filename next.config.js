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
  async rewrites() {
    const gilgilId = 'c51ec2ae-5b70-4f69-887d-54eb9f312db7'
    return [
      { source: '/school/gilgiltownship', destination: `/schools/${gilgilId}` },
      { source: '/school/gilgiltownship/:section(about|academics|news|contact)', destination: `/schools/${gilgilId}/:section` },
    ]
  },
}
module.exports = nextConfig
