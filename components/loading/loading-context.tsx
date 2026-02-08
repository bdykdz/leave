'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
  progress?: number;
}

interface LoadingContextType {
  globalLoading: LoadingState;
  operations: Map<string, LoadingState>;
  startLoading: (key?: string, text?: string) => void;
  stopLoading: (key?: string) => void;
  updateProgress: (progress: number, key?: string) => void;
  isAnyLoading: () => boolean;
  isOperationLoading: (key: string) => boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [globalLoading, setGlobalLoading] = useState<LoadingState>({ isLoading: false });
  const [operations] = useState<Map<string, LoadingState>>(new Map());
  const operationsRef = useRef(operations);

  const startLoading = useCallback((key?: string, text?: string) => {
    if (key) {
      operationsRef.current.set(key, { 
        isLoading: true, 
        loadingText: text,
        progress: 0 
      });
    } else {
      setGlobalLoading({ 
        isLoading: true, 
        loadingText: text,
        progress: 0 
      });
    }
  }, []);

  const stopLoading = useCallback((key?: string) => {
    if (key) {
      operationsRef.current.delete(key);
    } else {
      setGlobalLoading({ isLoading: false });
    }
  }, []);

  const updateProgress = useCallback((progress: number, key?: string) => {
    if (key) {
      const operation = operationsRef.current.get(key);
      if (operation) {
        operationsRef.current.set(key, { ...operation, progress });
      }
    } else {
      setGlobalLoading(prev => ({ ...prev, progress }));
    }
  }, []);

  const isAnyLoading = useCallback(() => {
    return globalLoading.isLoading || operationsRef.current.size > 0;
  }, [globalLoading.isLoading]);

  const isOperationLoading = useCallback((key: string) => {
    return operationsRef.current.has(key);
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        globalLoading,
        operations: operationsRef.current,
        startLoading,
        stopLoading,
        updateProgress,
        isAnyLoading,
        isOperationLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

// Hook for async operations with loading state
export function useAsyncOperation<T = any>(
  key: string,
  operation: (...args: any[]) => Promise<T>
) {
  const { startLoading, stopLoading, isOperationLoading } = useLoading();
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (...args: any[]) => {
      setError(null);
      startLoading(key);
      
      try {
        const result = await operation(...args);
        setData(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        stopLoading(key);
      }
    },
    [key, operation, startLoading, stopLoading]
  );

  return {
    execute,
    isLoading: isOperationLoading(key),
    error,
    data,
    reset: () => {
      setError(null);
      setData(null);
    },
  };
}