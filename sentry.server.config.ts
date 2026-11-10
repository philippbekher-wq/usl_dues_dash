// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://44b9dfb892aeb409059766e530d25198@o4512406989242368.ingest.de.sentry.io/4512407289266256",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // This app handles real player compensation data, Supabase session cookies, and the
  // Airtable token in outgoing request headers — none of that should leave for Sentry.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    stackFrameVariables: false,
  },
});
