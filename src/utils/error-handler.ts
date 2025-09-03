/**
 * Global error handling utilities
 */

export const setupGlobalErrorHandling = () => {
  console.log('[ErrorHandler] Setting up global error handling');

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[ErrorHandler] Unhandled promise rejection:', {
      reason: event.reason,
      promise: event.promise,
      stack: event.reason?.stack
    });
    
    // Prevent the default browser behavior
    event.preventDefault();
  });

  // Handle uncaught JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('[ErrorHandler] Uncaught JavaScript error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      stack: event.error?.stack
    });
  });

  // Handle React errors (if not caught by ErrorBoundary)
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Check for React errors
    if (args.length > 0 && typeof args[0] === 'string') {
      if (args[0].includes('currentPassword is not a function') || 
          args[0].includes('TypeError') ||
          args[0].includes('is not a function')) {
        console.error('[ErrorHandler] Potential function call error detected:', args);
        
        // Log additional context
        console.error('[ErrorHandler] Call stack:', new Error().stack);
      }
    }
    
    originalConsoleError.apply(console, args);
  };

  console.log('[ErrorHandler] Global error handling setup complete');
};

export const logComponentError = (componentName: string, error: Error, errorInfo?: any) => {
  console.error(`[ErrorHandler] Error in component ${componentName}:`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    errorInfo,
    timestamp: new Date().toISOString()
  });
};

export const logFunctionCallError = (functionName: string, context: any, error: Error) => {
  console.error(`[ErrorHandler] Function call error in ${functionName}:`, {
    context,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    timestamp: new Date().toISOString()
  });
};
