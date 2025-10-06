'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { LoadingProvider } from '@/components/loading/loading-context';
import { GlobalLoading } from '@/components/loading/global-loading';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // You can add custom error handling here
        // For example, show a toast notification
        if (typeof window !== 'undefined') {
          // Only run on client side
          console.error('Application Error:', error);
        }
      }}
    >
      <LoadingProvider>
        <GlobalLoading />
        {children}
        <Toaster />
      </LoadingProvider>
    </ErrorBoundary>
  );
}