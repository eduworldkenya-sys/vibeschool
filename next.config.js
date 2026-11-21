// Vibeschool's academic day is authoritative in Kenya time.
// Set this before Next.js evaluates server-rendered date and time content so
// hydration output matches learners' Nairobi-local browser experience.
process.env.TZ = 'Africa/Nairobi'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    forceSwcTransforms: false,
  },
  // Restrict only the public VibePro preview to an opaque-origin browser sandbox.
  // The business demo is not a trusted app or an authenticated finance workspace.
  async headers() {
    return [{
      source: '/vibepro/demo.html',
      headers: [
        { key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts allow-downloads allow-modals" },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }]
  },
}
module.exports = nextConfig
