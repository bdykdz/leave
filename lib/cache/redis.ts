import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('Redis not configured - caching disabled')
    return null
  }

  if (!redis) {
    try {
      if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL)
      } else {
        redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        })
      }

      redis.on('error', (error) => {
        console.error('Redis connection error:', error)
      })

      redis.on('connect', () => {
        console.log('Redis connected successfully')
      })
    } catch (error) {
      console.error('Failed to initialize Redis:', error)
      redis = null
    }
  }

  return redis
}

export async function disconnectRedis() {
  if (redis) {
    await redis.quit()
    redis = null
  }
}