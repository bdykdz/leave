import { getRedisClient } from '@/lib/cache/redis'

export class CacheService {
  private static redis = getRedisClient()

  // Cache team statistics with 5-minute TTL
  static async getTeamStats(managerId: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const cached = await this.redis.get(`team:stats:${managerId}`)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async setTeamStats(managerId: string, data: any): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.setex(`team:stats:${managerId}`, 300, JSON.stringify(data)) // 5 minutes
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Cache team leave calculations with 10-minute TTL
  static async getTeamLeaveCalculations(managerId: string, month?: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const key = month ? `team:leave:${managerId}:${month}` : `team:leave:${managerId}`
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async setTeamLeaveCalculations(managerId: string, data: any, month?: string): Promise<void> {
    if (!this.redis) return

    try {
      const key = month ? `team:leave:${managerId}:${month}` : `team:leave:${managerId}`
      await this.redis.setex(key, 600, JSON.stringify(data)) // 10 minutes
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Cache holiday planning calculations with 15-minute TTL
  static async getHolidayPlanCache(key: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const cached = await this.redis.get(`holiday:plan:${key}`)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async setHolidayPlanCache(key: string, data: any): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.setex(`holiday:plan:${key}`, 900, JSON.stringify(data)) // 15 minutes
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Cache team WFH statistics with 5-minute TTL
  static async getTeamWfhStats(managerId: string, month?: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const key = month ? `team:wfh:${managerId}:${month}` : `team:wfh:${managerId}`
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async setTeamWfhStats(managerId: string, data: any, month?: string): Promise<void> {
    if (!this.redis) return

    try {
      const key = month ? `team:wfh:${managerId}:${month}` : `team:wfh:${managerId}`
      await this.redis.setex(key, 300, JSON.stringify(data)) // 5 minutes
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Cache analytics data with 30-minute TTL
  static async getAnalyticsCache(userId: string, type: string): Promise<any | null> {
    if (!this.redis) return null

    try {
      const cached = await this.redis.get(`analytics:${type}:${userId}`)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  static async setAnalyticsCache(userId: string, type: string, data: any): Promise<void> {
    if (!this.redis) return

    try {
      await this.redis.setex(`analytics:${type}:${userId}`, 1800, JSON.stringify(data)) // 30 minutes
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  // Invalidate related caches when data changes
  static async invalidateTeamCache(managerId: string): Promise<void> {
    if (!this.redis) return

    try {
      // Use SCAN for better performance
      const stream = this.redis.scanStream({
        match: `team:*:${managerId}*`,
        count: 100
      })
      
      const keysToDelete: string[] = []
      
      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys)
      })
      
      stream.on('end', async () => {
        if (keysToDelete.length > 0) {
          await this.redis!.del(...keysToDelete)
        }
      })
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  static async invalidateHolidayCache(department?: string): Promise<void> {
    if (!this.redis) return

    try {
      let pattern = 'holiday:plan:*'
      if (department) {
        pattern = `holiday:plan:*${department}*`
      }
      
      // Use SCAN for better performance
      const stream = this.redis.scanStream({
        match: pattern,
        count: 100
      })
      
      const keysToDelete: string[] = []
      
      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys)
      })
      
      stream.on('end', async () => {
        if (keysToDelete.length > 0) {
          await this.redis!.del(...keysToDelete)
        }
      })
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  // General cache utilities (use with caution in production)
  static async clearCache(pattern?: string): Promise<void> {
    if (!this.redis) return

    try {
      // Use SCAN instead of KEYS for better performance
      const stream = this.redis.scanStream({
        match: pattern || '*',
        count: 100
      })
      
      const pipeline = this.redis.pipeline()
      let keyCount = 0

      stream.on('data', (keys: string[]) => {
        if (keys.length > 0) {
          keys.forEach(key => pipeline.del(key))
          keyCount += keys.length
        }
      })

      stream.on('end', async () => {
        if (keyCount > 0) {
          await pipeline.exec()
        }
      })
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  static async getCacheStats(): Promise<{ connected: boolean; keyCount: number } | null> {
    if (!this.redis) return null

    try {
      // Use INFO command for better performance instead of KEYS
      const info = await this.redis.info('keyspace')
      const dbMatch = info.match(/db0:keys=(\d+)/)
      const keyCount = dbMatch ? parseInt(dbMatch[1]) : 0
      
      return {
        connected: true,
        keyCount
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return {
        connected: false,
        keyCount: 0
      }
    }
  }
}