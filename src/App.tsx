import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import AuthenticatorApp from './components/AuthenticatorApp';
import UnlockForm from './components/UnlockForm';
import LoginForm from './components/LoginForm';
import { useAuth } from './context/AuthContext';
import { useEffect, useState } from 'react';
import { Config } from './utils/config';
import { loadConfig } from './utils/config';

const AppContent = () => {
  const { isAuthenticated, isLocked, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex overflow-auto items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {isLocked ? (
        <UnlockForm />
      ) : (
        <AuthenticatorApp />
      )}
    </div>
  );
};

function App() {
  // Initialize configuration
  const [, setCfg] = useState<Config | null>(null);
  
  useEffect(() => {
    loadConfig().then(setCfg);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
          <AppContent />
        </Layout>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;