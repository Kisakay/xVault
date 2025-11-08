import React, { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeSelector: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get the appropriate icon based on the current theme
  const getThemeIcon = () => {
    // For system theme, show the actual resolved theme icon (sun or moon)
    if (theme === 'system') {
      return resolvedTheme === 'dark' ? 
        <Moon className="w-5 h-5" /> : 
        <Sun className="w-5 h-5" />;
    }
    
    // For explicit themes, show their respective icons
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />;
      case 'dark':
        return <Moon className="w-5 h-5" />;
      default:
        return <Monitor className="w-5 h-5" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200 group"
        aria-label="Toggle theme"
        title="Change theme"
      >
        <div className="group-hover:scale-110 transition-transform duration-200">
          {getThemeIcon()}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="py-1.5" role="menu" aria-orientation="vertical">
            <button
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-4 py-2.5 text-sm transition-all duration-150 ${
                theme === 'light'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
              }`}
              role="menuitem"
            >
              <Sun className="w-4 h-4 mr-3" />
              Light
              {theme === 'light' && (
                <span className="ml-auto text-blue-600 dark:text-blue-400 font-bold">✓</span>
              )}
            </button>
            
            <button
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-4 py-2.5 text-sm transition-all duration-150 ${
                theme === 'dark'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
              }`}
              role="menuitem"
            >
              <Moon className="w-4 h-4 mr-3" />
              Dark
              {theme === 'dark' && (
                <span className="ml-auto text-blue-600 dark:text-blue-400 font-bold">✓</span>
              )}
            </button>
            
            <button
              onClick={() => {
                setTheme('system');
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-4 py-2.5 text-sm transition-all duration-150 ${
                theme === 'system'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
              }`}
              role="menuitem"
            >
              <Monitor className="w-4 h-4 mr-3" />
              System
              {theme === 'system' && (
                <span className="ml-auto text-blue-600 dark:text-blue-400 font-bold">✓</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
