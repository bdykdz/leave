'use client';

import React from 'react';
import { useLoading } from './loading-context';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalLoading() {
  const { globalLoading, operations, isAnyLoading } = useLoading();
  
  if (!isAnyLoading()) {
    return null;
  }

  // Get the first active operation for display
  const activeOperation = Array.from(operations.entries()).find(([_, state]) => state.isLoading);
  const displayState = activeOperation ? activeOperation[1] : globalLoading;
  const displayKey = activeOperation ? activeOperation[0] : 'global';

  return (
    <>
      {/* Full screen overlay for global loading */}
      {globalLoading.isLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {globalLoading.loadingText || 'Loading...'}
              </p>
            </div>
            {globalLoading.progress !== undefined && globalLoading.progress > 0 && (
              <Progress value={globalLoading.progress} className="w-full" />
            )}
          </div>
        </div>
      )}

      {/* Top bar loading indicator for operations */}
      {operations.size > 0 && !globalLoading.isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="bg-primary/10 backdrop-blur-sm border-b">
            <div className="container mx-auto px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-medium">
                    {displayState.loadingText || `Processing ${displayKey}...`}
                  </span>
                </div>
                {operations.size > 1 && (
                  <span className="text-xs text-muted-foreground">
                    {operations.size} operations in progress
                  </span>
                )}
              </div>
              {displayState.progress !== undefined && displayState.progress > 0 && (
                <Progress value={displayState.progress} className="w-full mt-1 h-1" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Button with loading state
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function LoadingButton({ 
  isLoading, 
  loadingText = 'Loading...', 
  children, 
  disabled,
  className,
  ...props 
}: LoadingButtonProps) {
  return (
    <button
      disabled={isLoading || disabled}
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      {...props}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-inherit rounded">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      <span className={cn(isLoading && "invisible")}>
        {children}
      </span>
    </button>
  );
}

// Skeleton loader for content
export function SkeletonLoader({ 
  rows = 3,
  className 
}: { 
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          {i === 0 && (
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          )}
        </div>
      ))}
    </div>
  );
}

// Loading spinner component
export function Spinner({ 
  size = 'md',
  className 
}: { 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 
      className={cn(
        "animate-spin text-primary",
        sizeClasses[size],
        className
      )}
    />
  );
}