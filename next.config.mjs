import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Re-enable for proper containerized deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  
  // Suppresses source map uploading logs during build
  silent: true,
  
  // Organization and project from your Sentry account
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  
  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
}

// Only wrap with Sentry in production or if SENTRY_DSN is set
const shouldUseSentry = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DSN;

export default shouldUseSentry 
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
