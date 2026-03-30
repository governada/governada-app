import type { NextConfig } from 'next';
import path from 'path';
import { execSync } from 'child_process';
import { withSentryConfig } from '@sentry/nextjs';
import withBundleAnalyzer from '@next/bundle-analyzer';

// Resolve the git main checkout root so turbopack can follow node_modules
// junctions from worktrees back to the main checkout.
let turbopackRoot: string;
try {
  turbopackRoot = execSync('git rev-parse --path-format=absolute --git-common-dir', {
    encoding: 'utf-8',
  })
    .trim()
    .replace(/[/\\]\.git$/, '');
} catch {
  turbopackRoot = __dirname;
}

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  turbopack: {
    // Worktrees use node_modules junctions pointing to the main checkout.
    // Root must encompass both the worktree and the junction target.
    root: turbopackRoot,
  },
  experimental: {
    // Enable browser-native View Transitions API for smooth route navigation.
    // GPU-accelerated, zero JavaScript cost. Graceful degradation in unsupported browsers.
    viewTransition: true,
  },
  serverExternalPackages: [
    'libsodium-wrappers-sumo',
    '@emurgo/cardano-serialization-lib-browser',
    '@emurgo/cardano-serialization-lib-nodejs',
  ],
  async headers() {
    // CSP is handled per-request in middleware.ts (nonce-based, dynamic).
    // Only static security headers remain here.
    return [
      {
        source: '/((?!api).*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // ── Navigation architecture v2 ────────────────────────────────────
      // Old sections → new sections
      { source: '/discover', destination: '/governance', permanent: true },
      { source: '/pulse', destination: '/governance/health', permanent: true },
      { source: '/pulse/history', destination: '/governance/health', permanent: true },
      {
        source: '/pulse/report/:epoch',
        destination: '/governance/health/epoch/:epoch',
        permanent: true,
      },
      { source: '/my-gov', destination: '/', permanent: true },
      { source: '/my-gov/identity', destination: '/you/identity', permanent: true },
      { source: '/my-gov/inbox', destination: '/you', permanent: true },
      { source: '/you/inbox', destination: '/you', permanent: true },
      { source: '/my-gov/profile', destination: '/you/settings', permanent: true },
      { source: '/engage', destination: '/', permanent: true },
      { source: '/learn', destination: '/help', permanent: true },
      { source: '/methodology', destination: '/help/methodology', permanent: true },

      // Legacy routes (pre-governada)
      { source: '/governance/calendar', destination: '/governance/health', permanent: true },
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/spo', destination: '/', permanent: true },
      { source: '/dashboard/inbox', destination: '/you', permanent: true },
      { source: '/profile', destination: '/you/settings', permanent: true },
      { source: '/treasury', destination: '/governance/treasury', permanent: true },
      { source: '/decentralization', destination: '/governance/health', permanent: true },
      {
        source: '/proposals/:txHash/:index',
        destination: '/proposal/:txHash/:index',
        permanent: true,
      },
      { source: '/proposals', destination: '/governance/proposals', permanent: true },

      // Committee route consolidation
      {
        source: '/discover/committee',
        destination: '/governance/committee',
        permanent: true,
      },

      // Three Worlds IA — delegation moved under You
      { source: '/delegation', destination: '/you/delegation', permanent: true },

      // Legacy get-started wizard — replaced by Globe Convergence + Seneca onboarding
      { source: '/get-started', destination: '/', permanent: true },

      // Workspace IA refactor — old sub-pages → new canonical routes
      { source: '/workspace/rationales', destination: '/workspace', permanent: false },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Fix MeshJS/libsodium bundling issues with webpack
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server: mark Cardano/WASM packages as external (use CJS at runtime)
      config.externals = config.externals || [];
      config.externals.push({
        'libsodium-wrappers-sumo': 'commonjs libsodium-wrappers-sumo',
        '@emurgo/cardano-serialization-lib-browser':
          'commonjs @emurgo/cardano-serialization-lib-browser',
        '@emurgo/cardano-serialization-lib-nodejs':
          'commonjs @emurgo/cardano-serialization-lib-nodejs',
      });
    } else {
      // Client: alias ESM libsodium (which tries to import a missing .mjs) to the CJS
      // build. We use path.resolve (not require.resolve) to bypass the package's
      // exports field restriction and point directly to the file.
      config.resolve.alias = {
        ...config.resolve.alias,
        'libsodium-wrappers-sumo': path.resolve(
          './node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js',
        ),
      };
    }

    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

const analyzed = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })(nextConfig);

export default withSentryConfig(analyzed, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
