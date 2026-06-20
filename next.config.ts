import type { NextConfig } from "next";

// Security headers applied to every route. These are the non-breaking,
// universally-safe set (no CSP yet — a strict Content-Security-Policy needs
// live testing against Supabase + the AI API calls before enabling, or it will
// silently break fetches; see TODO below).
const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (Vercel serves HTTPS only).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing the app on other origins (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Send only the origin on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // TODO(security): add a Content-Security-Policy once tested end-to-end against
  // Supabase (storage/realtime/auth) and the AI endpoints. Start in report-only
  // mode (Content-Security-Policy-Report-Only) to catch violations without
  // breaking the app, then promote to enforcing.
};

export default nextConfig;
