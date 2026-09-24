// FILE: next.config.mjs — Next.js build configuration for the PIID registration app.
// Depends on: nothing (static config, read at build time by Next.js / Vercel).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ===== SECTION: SECURITY HEADERS =====
  // The scanner page needs camera access; everything else is locked down.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
