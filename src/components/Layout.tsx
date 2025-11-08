import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, LogOut, Settings, ChevronDown } from 'lucide-react';
import ThemeSelector from './ThemeSelector';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
  };

  return (
    <div className="h-screen flex flex-col md:overflow-hidden overflow-auto">
      <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              xVault
            </h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <ThemeSelector />
            
            {isAuthenticated && user && (
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200 group"
                >
                  <div className="relative">
                    {user.logo ? (
                      <img 
                        src={user.logo} 
                        alt="User" 
                        className="w-9 h-9 rounded-xl object-cover ring-2 ring-gray-200 dark:ring-gray-700 group-hover:ring-blue-500 transition-all duration-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900 ring-1 ring-emerald-500/50"></div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-transparent dark:from-gray-800/50">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.name || 'My Vault'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate font-mono">ID: {user.loginId}</p>
                    </div>
                    
                    <div className="py-1.5">
                      <button
                        onClick={() => {
                          setProfileMenuOpen(true);
                          setMenuOpen(false);
                        }}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors duration-150"
                      >
                        <Settings className="mr-3 h-4 w-4" />
                        Profile Settings
                      </button>
                    </div>
                    
                    <div className="py-1.5 border-t border-gray-100 dark:border-gray-800">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors duration-150"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col overflow-auto">
        <div className="container mx-auto px-6 py-8 flex-1 flex flex-col max-w-7xl">
          {children}
        </div>
      </main>
      
      {/* Profile Menu Modal */}
      <ProfileMenu 
        isOpen={profileMenuOpen} 
        onClose={() => setProfileMenuOpen(false)} 
      />
      
      <footer className="py-6 border-t border-gray-200/50 dark:border-gray-800/50 glass">
        <div className="container mx-auto px-6 text-center text-sm text-gray-600 dark:text-gray-400 max-w-7xl">
          <p>© {new Date().getFullYear()} xVault. Your data is totally encrypted. See <a href="https://github.com/Kisakay/xVault" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-150 underline decoration-2 underline-offset-2">GitHub</a></p>
        </div>
      </footer>
    </div>
  );
};

export default Layout