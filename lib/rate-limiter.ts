import { NextRequest, NextResponse } from 'next/server';
import { log } from './logger';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean; // Only count successful requests
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

// In-memory store for rate limiting (use Redis in production)
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  increment(key: string, windowMs: number): { count: number; remaining: number; resetTime: number } {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = this.store.get(key);
    
    if (!existing || existing.resetTime < now) {
      // New window or expired
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, remaining: 0, resetTime };
    }
    
    // Increment existing
    existing.count++;
    return { 
      count: existing.count, 
      remaining: existing.resetTime - now,
      resetTime: existing.resetTime 
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

// Default configurations for different endpoints
export const rateLimitConfigs = {
  // Strict limit for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later',
  },
  
  // Moderate limit for leave request creation
  createLeaveRequest: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many leave requests, please try again later',
  },
  
  // Standard API limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many requests, please slow down',
  },
  
  // Lenient limit for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests, please slow down',
  },
  
  // Very strict limit for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    message: 'Too many sensitive operations, please contact support if you need assistance',
  },
  
  // File upload limit
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20,
    message: 'Too many file uploads, please try again later',
  },
};

/**
 * Creates a rate limiter middleware
 */
export function rateLimit(config: RateLimitConfig | keyof typeof rateLimitConfigs) {
  const finalConfig: RateLimitConfig = typeof config === 'string' 
    ? rateLimitConfigs[config] 
    : config;

  return async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
    // Skip rate limiting in development if configured
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
      return null;
    }

    // Generate key for this request
    const key = finalConfig.keyGenerator?.(req) || getDefaultKey(req);
    
    // Check rate limit
    const { count, remaining, resetTime } = store.increment(key, finalConfig.windowMs);
    
    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', String(finalConfig.maxRequests));
    headers.set('X-RateLimit-Remaining', String(Math.max(0, finalConfig.maxRequests - count)));
    headers.set('X-RateLimit-Reset', String(Math.floor(resetTime / 1000)));
    
    // Check if limit exceeded
    if (count > finalConfig.maxRequests) {
      log.warn('Rate limit exceeded', {
        key,
        count,
        limit: finalConfig.maxRequests,
        path: req.nextUrl.pathname,
        ip: getClientIp(req),
      });
      
      headers.set('Retry-After', String(Math.ceil(remaining / 1000)));
      
      return NextResponse.json(
        {
          error: finalConfig.message || 'Too many requests',
          retryAfter: Math.ceil(remaining / 1000),
        },
        { 
          status: 429,
          headers,
        }
      );
    }
    
    // Request is within limit
    return null;
  };
}

/**
 * Generates a default key based on IP and user session
 */
function getDefaultKey(req: NextRequest): string {
  const ip = getClientIp(req);
  const userId = req.headers.get('x-user-id') || 'anonymous';
  const path = req.nextUrl.pathname;
  
  return `${ip}:${userId}:${path}`;
}

/**
 * Extracts client IP from request
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const real = req.headers.get('x-real-ip');
  if (real) {
    return real;
  }
  
  // Default to a placeholder in development
  return process.env.NODE_ENV === 'development' ? 'dev-client' : 'unknown';
}

/**
 * Reset rate limit for a specific key
 */
export function resetRateLimit(req: NextRequest): void {
  const key = getDefaultKey(req);
  store.reset(key);
}

/**
 * Middleware to apply rate limiting to API routes
 */
export async function withRateLimit(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig | keyof typeof rateLimitConfigs = 'api'
): Promise<NextResponse> {
  const limiter = rateLimit(config);
  const limitResponse = await limiter(req);
  
  if (limitResponse) {
    return limitResponse;
  }
  
  return handler(req);
}