// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',

  // Filter out specific errors
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      return null;
    }

    // Filter out authentication errors (these are handled by the app)
    if (hint.originalException) {
      const error = hint.originalException as Error;
      if (error.message?.includes("Unauthorized") || 
          error.message?.includes("Not authenticated") ||
          error.message?.includes("Session expired")) {
        return null;
      }
    }

    return event;
  },

  // Set environment
  environment: process.env.NODE_ENV,
});