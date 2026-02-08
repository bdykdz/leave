import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
  keyGenerator?: (request: NextRequest) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory storage (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Cleanup every minute

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    keyGenerator = (request) => getClientIdentifier(request)
  } = config

  return (request: NextRequest): NextResponse | null => {
    const key = keyGenerator(request)
    const now = Date.now()
    const windowStart = now - windowMs

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      }
    }

    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      return NextResponse.json(
        { 
          error: message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString()
          }
        }
      )
    }

    // Increment counter
    entry.count++
    rateLimitStore.set(key, entry)

    // Add rate limit headers (for debugging/monitoring)
    const remaining = maxRequests - entry.count
    
    // Return null to indicate request should continue
    return null
  }
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnecting = request.headers.get('cf-connecting-ip')
  
  let ip = 'unknown'
  if (forwarded) {
    ip = forwarded.split(',')[0].trim()
  } else if (realIp) {
    ip = realIp
  } else if (cfConnecting) {
    ip = cfConnecting
  }

  // Could also include user ID if available
  // const userId = getUserIdFromRequest(request)
  // return userId ? `user:${userId}` : `ip:${ip}`
  
  return `ip:${ip}`
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // General API endpoints
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },
  
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later.'
  },
  
  // Form submissions (leave requests, holiday planning)
  submission: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'Too many submissions, please wait before submitting again.'
  },
  
  // Approval actions (by managers)
  approval: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many approval actions, please slow down.'
  },
  
  // File uploads
  upload: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many file uploads, please wait before uploading again.'
  }
}

/**
 * Helper function to apply rate limiting to API routes
 */
export function withRateLimit<T extends any[]>(
  config: RateLimitConfig,
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const rateLimitResponse = rateLimit(config)(request)
    if (rateLimitResponse) {
      return rateLimitResponse
    }
    
    return handler(request, ...args)
  }
}