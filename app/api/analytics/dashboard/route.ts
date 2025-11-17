import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { AnalyticsService } from '@/lib/services/analytics-service'
import { CacheService } from '@/lib/services/cache-service'
import { rateLimit, rateLimitConfigs } from '@/lib/middleware/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimit(rateLimitConfigs.general)(request)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'

    const userId = session.user?.id || ''

    // Check cache first for all analytics types
    const cachedData = await CacheService.getAnalyticsCache(userId, type)
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    let analyticsData: any

    switch (type) {
      case 'overview':
        analyticsData = await AnalyticsService.getDashboardMetrics(userId)
        break

      case 'trends':
        const months = parseInt(searchParams.get('months') || '12')
        analyticsData = await AnalyticsService.getLeaveUsageTrends(userId, months)
        break

      case 'departments':
        analyticsData = await AnalyticsService.getDepartmentAnalytics(userId)
        break

      case 'approvals':
        analyticsData = await AnalyticsService.getApprovalMetrics(userId)
        break

      case 'seasonal':
        analyticsData = await AnalyticsService.getSeasonalAnalytics(userId)
        break

      case 'coverage':
        const days = parseInt(searchParams.get('days') || '30')
        analyticsData = await AnalyticsService.getTeamCoverageAnalytics(userId, days)
        break

      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
    }

    // Cache the result
    await CacheService.setAnalyticsCache(userId, type, analyticsData)
    return NextResponse.json(analyticsData)

  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}