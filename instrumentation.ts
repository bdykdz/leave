export async function register() {
  // Only run scheduled tasks on the server (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvOrDie } = await import('./lib/config')
    validateEnvOrDie()

    const { scheduleCronJobs } = await import('./lib/cron-scheduler')
    scheduleCronJobs()
  }
}
