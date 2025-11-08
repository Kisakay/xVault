import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginForm: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginIdCopied, setLoginIdCopied] = useState(false);
  const [newLoginId, setNewLoginId] = useState<string | null>(null);

  const { login, register, loginError, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegistering) {
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      const result = await register(password);
      if (result.success && result.loginId) {
        setNewLoginId(result.loginId);
      } else {
        setError(result.error || 'Registration failed');
      }
    } else {
      if (!loginId) {
        setError('Login ID is required');
        return;
      }
      if (!password) {
        setError('Password is required');
        return;
      }

      const result = await login(loginId, password);
      if (result !== true && typeof result !== 'boolean') {
        setError(result.error || 'Login failed');
      }
    }
  };

  const copyLoginId = () => {
    if (newLoginId) {
      navigator.clipboard.writeText(newLoginId);
      setLoginIdCopied(true);
      setTimeout(() => setLoginIdCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setNewLoginId(null);
    setPassword('');
    setLoginId('');
    setError(null);
  };

  if (newLoginId) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Registration Successful</h2>
            <p className="text-gray-600 dark:text-gray-400">Your account has been created!</p>
          </div>
          
          <div className="mb-6 p-5 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
            <p className="text-emerald-800 dark:text-emerald-200 mb-3 font-medium">
              <strong>Important:</strong> Please save your login ID. You will need it to access your vault.
            </p>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white dark:bg-gray-800 p-3 rounded-lg font-mono text-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                {newLoginId}
              </div>
              <button 
                onClick={copyLoginId}
                className={`px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
                  loginIdCopied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loginIdCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          
          <button
            onClick={() => {
              setIsRegistering(false);
              resetForm();
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-medium"
          >
            Continue to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isRegistering ? 'Create a New Vault' : 'Access Your Vault'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {isRegistering ? 'Start securing your accounts' : 'Welcome back'}
          </p>
        </div>
        
        {(error || loginError) && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-800 dark:text-red-300">
            {error || loginError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isRegistering && (
            <div>
              <label htmlFor="loginId" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Login ID
              </label>
              <input
                type="text"
                id="loginId"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white transition-all duration-200"
                placeholder="Enter your login ID"
                autoComplete="username"
              />
            </div>
          )}
          
          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {isRegistering ? 'Create Password' : 'Password'}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 text-gray-900 dark:text-white transition-all duration-200"
              placeholder={isRegistering ? "Create a strong password" : "Enter your password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
            />
            {isRegistering && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This password will be used to encrypt your vault. Make sure it's strong and you remember it.
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Processing...' : isRegistering ? 'Create Vault' : 'Unlock Vault'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              resetForm();
            }}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-150 underline decoration-2 underline-offset-2"
          >
            {isRegistering ? 'Already have a vault? Login' : 'Create a new vault'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
