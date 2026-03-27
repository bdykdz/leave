import cron from 'node-cron'

let scheduled = false

export function scheduleCronJobs() {
  // Prevent double-scheduling (Next.js may call register() multiple times)
  if (scheduled) return
  scheduled = true

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cronSecret) {
    headers['Authorization'] = `Bearer ${cronSecret}`
  }

  // WFH auto-cancel: Every Friday at 23:59 UTC (Saturday 01:59 Bucharest)
  cron.schedule('59 23 * * 5', async () => {
    console.log('[CRON] Running WFH auto-cancel...')
    try {
      const res = await fetch(`${baseUrl}/api/cron/wfh-auto-cancel`, { headers })
      const data = await res.json()
      console.log('[CRON] WFH auto-cancel result:', data)
    } catch (error) {
      console.error('[CRON] WFH auto-cancel failed:', error)
    }
  }, { timezone: 'UTC' })

  // Escalation check: Every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('[CRON] Running escalation check...')
    try {
      const res = await fetch(`${baseUrl}/api/cron/escalation`, { headers })
      const data = await res.json()
      console.log('[CRON] Escalation result:', data)
    } catch (error) {
      console.error('[CRON] Escalation failed:', error)
    }
  }, { timezone: 'UTC' })

  // Document cleanup: DISABLED — documents should be retained indefinitely
  // cron.schedule('0 3 * * 1', async () => {
  //   console.log('[CRON] Running document cleanup...')
  //   try {
  //     const res = await fetch(`${baseUrl}/api/cron/document-cleanup`, { headers })
  //     const data = await res.json()
  //     console.log('[CRON] Document cleanup result:', data)
  //   } catch (error) {
  //     console.error('[CRON] Document cleanup failed:', error)
  //   }
  // }, { timezone: 'UTC' })

  // Admin cleanup: Daily at 02:00 UTC
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Running admin cleanup...')
    try {
      const res = await fetch(`${baseUrl}/api/admin/cleanup`, { headers })
      const data = await res.json()
      console.log('[CRON] Admin cleanup result:', data)
    } catch (error) {
      console.error('[CRON] Admin cleanup failed:', error)
    }
  }, { timezone: 'UTC' })

  console.log('[CRON] Scheduled jobs:')
  console.log('  - WFH auto-cancel: Friday 23:59 UTC (01:59 Bucharest Saturday)')
  console.log('  - Escalation check: every 4 hours')
  console.log('  - Document cleanup: DISABLED')
  console.log('  - Admin cleanup: daily 02:00 UTC')
}
