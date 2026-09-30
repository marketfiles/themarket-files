import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  // Inline config/theme bootstrap + fallback map-data CDNs used only if /geo/*.json is missing.
  // TradingView widgets and Google Programmable Search load their own scripts/frames.
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://s3.tradingview.com https://cse.google.com https://*.google.com https://*.googleapis.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.google.com https://*.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "frame-src https://*.tradingview.com https://www.tradingview-widget.com https://cse.google.com https://*.google.com",
  "connect-src 'self' https://*.google.com https://*.googleapis.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      { source: '/experience/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=86400' }] },
      { source: '/geo/:file*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, immutable' }] },
    ];
  },
};

export default nextConfig;
