import { AuthProvider } from '@/context/AuthContext';
import { ThemeManager } from '@/themes/ThemeManager';
import { AppRouter } from '@/router/AppRouter';

function App() {
  return (
    <ThemeManager defaultTheme="dark" storageKey="zap-vault-theme">
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeManager>
  );
}

export default App;
