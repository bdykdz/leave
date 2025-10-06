import { NextRequest, NextResponse } from 'next/server';
import { log } from './logger';

type AsyncHandler<T = any> = (
  req: NextRequest,
  params?: any
) => Promise<NextResponse<T>>;

/**
 * Wraps async route handlers to catch and handle errors properly
 */
export function asyncHandler<T = any>(handler: AsyncHandler<T>) {
  return async (req: NextRequest, params?: any) => {
    try {
      const startTime = Date.now();
      const response = await handler(req, params);
      const duration = Date.now() - startTime;
      
      // Log successful API calls
      log.api(
        req.method,
        req.nextUrl.pathname,
        response.status,
        duration
      );
      
      return response;
    } catch (error) {
      const duration = Date.now();
      
      // Log the error
      log.error(`API Error: ${req.method} ${req.nextUrl.pathname}`, error, {
        method: req.method,
        path: req.nextUrl.pathname,
        query: Object.fromEntries(req.nextUrl.searchParams),
      });
      
      // Handle different types of errors
      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('Unauthorized')) {
          return NextResponse.json(
            { error: 'Unauthorized access' },
            { status: 401 }
          );
        }
        
        if (error.message.includes('Not found')) {
          return NextResponse.json(
            { error: 'Resource not found' },
            { status: 404 }
          );
        }
        
        if (error.message.includes('Validation') || error.message.includes('Invalid')) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        
        // Database errors
        if (error.message.includes('Unique constraint') || error.message.includes('Foreign key')) {
          return NextResponse.json(
            { error: 'Database constraint violation' },
            { status: 409 }
          );
        }
        
        // Default error response
        const isDevelopment = process.env.NODE_ENV === 'development';
        return NextResponse.json(
          {
            error: 'Internal server error',
            ...(isDevelopment && { 
              message: error.message,
              stack: error.stack 
            }),
          },
          { status: 500 }
        );
      }
      
      // Unknown error type
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wraps async functions to handle errors
 * Useful for non-route handlers
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  defaultValue?: T,
  errorMessage?: string
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    log.error(errorMessage || 'Async operation failed', error);
    return defaultValue;
  }
}

/**
 * Retries an async operation with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        log.warn(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`, {
          delay,
          error: error instanceof Error ? error.message : String(error),
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  log.error(`Operation failed after ${maxRetries} attempts`, lastError);
  throw lastError;
}

/**
 * Wraps a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Batches multiple async operations and handles errors gracefully
 */
export async function batchAsync<T>(
  operations: (() => Promise<T>)[],
  options: {
    stopOnError?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<{ results: T[]; errors: Error[] }> {
  const { stopOnError = false, maxConcurrent = 5 } = options;
  const results: T[] = [];
  const errors: Error[] = [];
  
  // Process in chunks to limit concurrent operations
  for (let i = 0; i < operations.length; i += maxConcurrent) {
    const chunk = operations.slice(i, i + maxConcurrent);
    
    const chunkResults = await Promise.allSettled(
      chunk.map(op => op())
    );
    
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const error = result.reason instanceof Error 
          ? result.reason 
          : new Error(String(result.reason));
        errors.push(error);
        
        if (stopOnError) {
          log.error('Batch operation stopped due to error', error);
          break;
        }
      }
    }
    
    if (stopOnError && errors.length > 0) {
      break;
    }
  }
  
  if (errors.length > 0) {
    log.warn(`Batch operation completed with ${errors.length} errors`, {
      totalOperations: operations.length,
      successful: results.length,
      failed: errors.length,
    });
  }
  
  return { results, errors };
}