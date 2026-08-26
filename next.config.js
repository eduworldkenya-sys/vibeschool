// Vibeschool's academic day is authoritative in Kenya time.
// Set this before Next.js evaluates server-rendered date and time content so
// hydration output matches learners' Nairobi-local browser experience.
process.env.TZ = 'Africa/Nairobi'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: false,
  },
}
module.exports = nextConfig
