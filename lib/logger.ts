/**
 * Centralized logging service
 * - In production: Logs are suppressed or sent to monitoring service
 * - In development: Logs are shown in console
 * - Sensitive data is automatically redacted
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'error');
  
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    const configuredLevel = this.levels[this.logLevel as LogLevel] || 1;
    return this.levels[level] >= configuredLevel;
  }

  private sanitize(data: any): any {
    if (typeof data === 'string') {
      // Redact email addresses
      data = data.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[REDACTED_EMAIL]');
      // Redact potential passwords
      data = data.replace(/password["\s]*[:=]["\s]*["']?[^"',}\s]+["']?/gi, 'password: [REDACTED]');
      // Redact API keys
      data = data.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
        if (match.length > 32) {
          return '[REDACTED_KEY]';
        }
        return match;
      });
    } else if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
          sanitized[key] = '[REDACTED]';
        } else if (key.toLowerCase().includes('email') && typeof data[key] === 'string') {
          sanitized[key] = data[key].replace(/^(.{2}).*(@.*)$/, '$1***$2');
        } else {
          sanitized[key] = this.sanitize(data[key]);
        }
      }
      return sanitized;
    }
    return data;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? this.sanitize(context) : null;
    
    if (this.isDevelopment) {
      return sanitizedContext 
        ? `[${timestamp}] [${level.toUpperCase()}] ${message}`
        : `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }
    
    // In production, format for structured logging
    return JSON.stringify({
      timestamp,
      level,
      message,
      context: sanitizedContext,
      environment: process.env.NODE_ENV,
    });
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug') && this.isDevelopment) {
      console.log(this.formatMessage('debug', message, context));
      if (context) {
        console.log('Context:', this.sanitize(context));
      }
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      if (this.isDevelopment) {
        console.info(this.formatMessage('info', message, context));
        if (context) {
          console.info('Context:', this.sanitize(context));
        }
      } else {
        // In production, you might send to a logging service
        // For now, we'll suppress it
      }
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message, context);
      if (this.isDevelopment) {
        console.warn(formatted);
        if (context) {
          console.warn('Context:', this.sanitize(context));
        }
      } else {
        // In production, log warnings to a file or service
        // For now, we'll use console.warn with sanitized data
        console.warn(formatted);
      }
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorDetails = error instanceof Error ? {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      } : error;
      
      const formatted = this.formatMessage('error', message, {
        ...context,
        error: this.sanitize(errorDetails),
      });
      
      console.error(formatted);
      
      // In production, send to error tracking service (e.g., Sentry)
      if (!this.isDevelopment && (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)) {
        // Dynamic import to avoid issues in environments without Sentry
        if (typeof window !== 'undefined') {
          import('@sentry/nextjs').then((Sentry) => {
            Sentry.captureException(error instanceof Error ? error : new Error(message), {
              level: 'error',
              extra: this.sanitize(context)
            });
          }).catch(() => {
            // Sentry not available, fallback to console
            console.error('Failed to send error to Sentry');
          });
        }
      }
    }
  }

  // Method to log API requests (useful for debugging)
  api(method: string, path: string, status: number, duration: number, context?: LogContext): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    
    if (this.shouldLog(level)) {
      const message = `${method} ${path} - ${status} (${duration}ms)`;
      
      switch (level) {
        case 'error':
          this.error(message, undefined, context);
          break;
        case 'warn':
          this.warn(message, context);
          break;
        default:
          this.info(message, context);
      }
    }
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, error?: Error | unknown, context?: LogContext) => logger.error(message, error, context),
  api: (method: string, path: string, status: number, duration: number, context?: LogContext) => 
    logger.api(method, path, status, duration, context),
};