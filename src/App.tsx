import { useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeManager } from '@/themes/ThemeManager';
import { AppRouter } from '@/router/AppRouter';
import ErrorBoundary from '@/components/ErrorBoundary';
import { setupGlobalErrorHandling } from '@/utils/error-handler';

function App() {
  useEffect(() => {
    console.log('[App] Initializing ZAP Quantum Vault application');
    setupGlobalErrorHandling();
    console.log('[App] Application initialization complete');
  }, []);

  return (
    <ErrorBoundary>
      <ThemeManager defaultTheme="dark" storageKey="zap-vault-theme">
        <ErrorBoundary>
          <AuthProvider>
            <ErrorBoundary>
              <AppRouter />
            </ErrorBoundary>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeManager>
    </ErrorBoundary>
  );
}

export default App;
