import { z } from 'zod'

/**
 * Startup environment validation.
 *
 * Called once from instrumentation.ts when the Node.js server boots.
 * Required variables missing → the process refuses to start (fail fast,
 * instead of failing at some random runtime point days later).
 * Recommended variables missing → loud warning, feature degrades.
 */

const requiredInProduction = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(16),
  AZURE_AD_CLIENT_ID: z.string().min(1),
  AZURE_AD_CLIENT_SECRET: z.string().min(1),
  AZURE_AD_TENANT_ID: z.string().min(1),
})

const requiredAlways = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
})

// Missing these doesn't stop the app, but the named feature silently breaks.
const recommended: Array<{ key: string; feature: string }> = [
  { key: 'CRON_SECRET', feature: 'scheduled jobs (escalation, WFH auto-cancel, cleanup, export sync)' },
  { key: 'RESEND_API_KEY', feature: 'email notifications' },
  { key: 'RESEND_FROM_EMAIL', feature: 'email notifications' },
  { key: 'MINIO_ENDPOINT', feature: 'document storage' },
  { key: 'MINIO_ACCESS_KEY', feature: 'document storage' },
  { key: 'MINIO_SECRET_KEY', feature: 'document storage' },
  { key: 'REDIS_URL', feature: 'caching' },
]

export function validateEnvOrDie(): void {
  const isProd = process.env.NODE_ENV === 'production'
  const schema = isProd ? requiredInProduction : requiredAlways

  const result = schema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.'))
    console.error(
      `[config] FATAL: invalid/missing required environment variables: ${missing.join(', ')}`
    )
    // Fail fast — running with broken config corrupts behavior unpredictably.
    process.exit(1)
  }

  for (const { key, feature } of recommended) {
    if (!process.env[key]) {
      console.warn(`[config] WARNING: ${key} is not set — ${feature} will not work.`)
    }
  }
}
