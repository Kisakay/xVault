import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateTOTP, getTimeRemaining } from '../utils/totp';
import { TOTPEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { Copy, Edit, Trash2, Check, XIcon as Icons, AlertTriangle } from 'lucide-react';
import IconSelector from './IconSelector';

interface TOTPCardProps {
  entry: TOTPEntry;
  currentTime: number;
}

const TOTPCard: React.FC<TOTPCardProps> = ({ entry, currentTime }) => {
  const { updateEntry, deleteEntry } = useAuth();
  const [code, setCode] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(entry.name);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Référence pour détecter les clics en dehors du menu de confirmation
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Fermer le menu de confirmation lorsque l'utilisateur clique en dehors
  useEffect(() => {
    if (!showDeleteConfirm) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (deleteConfirmRef.current && 
          !deleteConfirmRef.current.contains(event.target as Node) &&
          deleteButtonRef.current &&
          !deleteButtonRef.current.contains(event.target as Node)) {
        setShowDeleteConfirm(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    const updateCode = async () => {
      // Generate the TOTP code
      const newCode = await generateTOTP(entry.secret, entry.period, entry.digits);
      setCode(newCode);
    };
    updateCode();

    // Calculate time remaining until next refresh
    const remaining = getTimeRemaining(entry.period);
    setTimeRemaining(remaining);
  }, [entry, currentTime]);

  // Format code with space in the middle for readability
  const formattedCode = code.length === 6
    ? `${code.substring(0, 3)} ${code.substring(3)}`
    : code;

  const copyToClipboard = () => {
    // Vérifie si nous sommes en HTTPS ou localhost (contexte sécurisé)
    const isSecureContext = window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    // Méthode compatible avec HTTP et HTTPS
    const copyWithFallback = () => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        // Rendre l'élément invisible mais accessible
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);

        // Sélectionner et copier le texte
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          console.error('Failed to copy with execCommand');
          throw new Error('execCommand copy failed');
        }
      } catch (err) {
        console.error('Fallback copy method failed:', err);
        alert('Failed to copy code to clipboard');
      }
    };

    // Essayer d'abord l'API moderne si nous sommes dans un contexte sécurisé
    if (isSecureContext && navigator.clipboard) {
      navigator.clipboard.writeText(code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          // Si l'API moderne échoue, utiliser la méthode de secours
          copyWithFallback();
        });
    } else {
      // Utiliser directement la méthode de secours en contexte non sécurisé
      copyWithFallback();
    }
  };

  const handleSave = () => {
    if (newName.trim()) {
      updateEntry(entry.id, { name: newName.trim() });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };
  
  const handleDelete = () => {
    deleteEntry(entry.id);
    setShowDeleteConfirm(false);
  };

  const changeIcon = (icon: string) => {
    updateEntry(entry.id, { icon });
    setShowIconSelector(false);
  };

  const rootHoverClass = showIconSelector || showDeleteConfirm ? '' : 'hover:shadow-lg hover:-translate-y-1 hover:border-l-blue-600 dark:hover:border-l-blue-400';
  return (
    <div className={`group relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-xl border-l-4 border-blue-500 shadow-sm border border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 ${rootHoverClass}`}>
      <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        {/* Icon Section */}
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowIconSelector(true)}
            className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200 relative overflow-hidden hover:scale-105 ${
              entry.icon && entry.icon.startsWith('data:image') 
                ? 'ring-2 ring-gray-200 dark:ring-gray-700' 
                : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-700 dark:hover:to-gray-600'
            }`}
          >
            {entry.icon ? (
              entry.icon.startsWith('data:image') ? (
                <img src={entry.icon} alt="Custom icon" className="w-full h-full object-cover object-center" />
              ) : (
                <span className="text-xl sm:text-2xl">{entry.icon}</span>
              )
            ) : (
              <Icons className="w-7 h-7 sm:w-8 sm:h-8" />
            )}
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full">
          {/* Title Section */}
          <div className="flex-1 min-w-0 w-full sm:w-auto">
            {isEditing ? (
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                autoFocus
                className="w-full font-semibold text-base sm:text-lg text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h3 className="font-semibold text-base sm:text-lg text-gray-900 dark:text-white break-words sm:truncate">
                {entry.name}
              </h3>
            )}
            <div className="mt-2 flex items-center gap-3 sm:gap-4">
              <div className="h-2 sm:h-2.5 w-24 sm:w-32 bg-gray-200/80 dark:bg-gray-700/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${(timeRemaining / (entry.period || 30)) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                {timeRemaining}s
              </p>
            </div>
          </div>

          {/* Code Section */}
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-200/50 dark:border-gray-700/50">
              <p className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-gray-900 dark:text-white select-all">
                {formattedCode}
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 flex-shrink-0 ${
                copied 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                  : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          {/* Actions Section */}
          <div className="flex items-center gap-1 flex-shrink-0 sm:ml-auto">
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 sm:p-2.5 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-150"
              title="Edit"
            >
              <Edit size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button
              ref={deleteButtonRef}
              onClick={confirmDelete}
              className={`p-2 sm:p-2.5 rounded-lg transition-all duration-150 ${
                showDeleteConfirm 
                  ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20' 
                  : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              }`}
              title="Delete"
            >
              <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {showIconSelector && createPortal(
        <IconSelector
          onSelect={changeIcon}
          onClose={() => setShowIconSelector(false)}
        />,
        document.body
      )}
      
      {/* Menu de confirmation de suppression */}
      {showDeleteConfirm && createPortal(
        <>
          {/* Overlay avec effet de flou */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998] animate-in fade-in duration-200"></div>
          
          {/* Modal de confirmation */}
          <div 
            ref={deleteConfirmRef}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 z-[9999] w-[90%] max-w-[400px] animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm deletion</h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">{entry.name}</span>? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl transition-all duration-150 shadow-lg shadow-red-500/25"
              >
                Delete
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default TOTPCard;