import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import TOTPCard from './TOTPCard';
import AddTOTPForm from './AddTOTPForm';
import EmptyState from './EmptyState';
import VaultActions from './VaultActions';
import FolderList from './FolderList';
import { PlusCircle, X, FolderPlus } from 'lucide-react';

const AuthenticatorApp: React.FC = () => {
  const { entries, folders, addFolder, moveEntryToFolder } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showFolderSelector, setShowFolderSelector] = useState<string | null>(null);
  
  // Références pour détecter les clics en dehors du menu
  const folderSelectorRef = useRef<HTMLDivElement>(null);
  const folderButtonRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // Update time every second to keep countdown accurate
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Fermer le menu de sélection de dossier lorsque l'utilisateur clique en dehors
  useEffect(() => {
    if (!showFolderSelector) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      // Vérifier si le clic est en dehors du menu et du bouton qui l'a ouvert
      const isOutsideMenu = folderSelectorRef.current && !folderSelectorRef.current.contains(event.target as Node);
      const button = folderButtonRefs.current.get(showFolderSelector);
      const isOutsideButton = button && !button.contains(event.target as Node);
      
      if (isOutsideMenu && isOutsideButton) {
        setShowFolderSelector(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFolderSelector]);

  // Filtrer les entrées par dossier et terme de recherche
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFolder = activeFolder === null || entry.folderId === activeFolder;
    return matchesSearch && matchesFolder;
  });
  
  // Obtenir le nom du dossier actif
  const activeFolderName = activeFolder 
    ? folders.find(f => f.id === activeFolder)?.name || 'Unknown Folder'
    : 'All Codes';

  // Gérer le déplacement d'une entrée vers un dossier
  const handleMoveToFolder = (entryId: string, folderId: string | null) => {
    moveEntryToFolder(entryId, folderId);
    setShowFolderSelector(null);
  };
  
  // Enregistrer la référence au bouton qui ouvre le menu de sélection de dossier
  const setFolderButtonRef = (entryId: string, element: HTMLButtonElement | null) => {
    folderButtonRefs.current.set(entryId, element);
  };

  // Créer un nouveau dossier rapidement
  const handleQuickCreateFolder = () => {
    const folderName = prompt('Folder name:');
    if (folderName && folderName.trim()) {
      addFolder({
        name: folderName.trim(),
        icon: '📁',
        color: '#3b82f6',
        isExpanded: true
      });
    }
  };

  return (
    <div className="w-full h-full overflow-hidden flex flex-col md:flex-row gap-6">
      {/* Barre latérale des dossiers */}
      <aside className="w-full md:w-72 flex-shrink-0">
        <div className="hidden md:block h-full rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 p-6 overflow-y-auto">
          <FolderList 
            activeFolder={activeFolder}
            onSelectFolder={setActiveFolder}
          />
        </div>
      </aside>
      
      {/* Contenu principal */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{activeFolderName}</h2>
                {activeFolder !== null && (
                  <button
                    onClick={() => setActiveFolder(null)}
                    className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-150"
                  >
                    View all
                  </button>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {activeFolder === null
                  ? 'Manage all your authentication codes'
                  : `Manage codes in the "${activeFolderName}" folder`
                }
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="md:hidden flex items-center gap-2">
                <button
                  onClick={handleQuickCreateFolder}
                  className="p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200"
                  title="Add folder"
                >
                  <FolderPlus size={20} />
                </button>
                <VaultActions />
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-medium"
              >
                <PlusCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Add new key</span>
                <span className="sm:hidden">Add</span>
              </button>
              <button
                onClick={handleQuickCreateFolder}
                className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-200 font-medium"
              >
                <FolderPlus className="w-5 h-5" />
                Folder
              </button>
              <VaultActions className="hidden md:block" />
            </div>
          </div>
          
          {entries.length > 0 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        {entries.length === 0 ? (
          <EmptyState onAddNew={() => setShowAddForm(true)} />
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">No accounts match your search</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="relative group">
                <TOTPCard 
                  entry={entry}
                  currentTime={currentTime}
                />
                
                {/* Menu de sélection de dossier */}
                {showFolderSelector === entry.id && (
                  <div ref={folderSelectorRef} className="absolute right-4 top-16 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-xl rounded-xl border border-gray-200/50 dark:border-gray-800/50 p-2 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">
                      Move to folder
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      <button
                        onClick={() => handleMoveToFolder(entry.id, null)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                          !entry.folderId 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                        }`}
                      >
                        Root
                      </button>
                      
                      {folders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => handleMoveToFolder(entry.id, folder.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center transition-all duration-150 ${
                            entry.folderId === folder.id 
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
                          }`}
                        >
                          <span className="mr-2 text-lg" style={{ color: folder.color }}>{folder.icon || '📁'}</span>
                          {folder.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Bouton pour afficher le sélecteur de dossier */}
                <button
                  ref={(el) => setFolderButtonRef(entry.id, el)}
                  onClick={() => setShowFolderSelector(showFolderSelector === entry.id ? null : entry.id)}
                  className={`absolute top-4 right-4 p-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 ${
                    showFolderSelector === entry.id ? 'opacity-100 !bg-blue-100 dark:!bg-blue-900/50' : ''
                  }`}
                  title="Move to folder"
                >
                  <FolderPlus size={16} className={`transition-colors ${
                    showFolderSelector === entry.id 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden border border-gray-200/50 dark:border-gray-800/50 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-200/50 dark:border-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add New TOTP Key</h3>
              <button 
                onClick={() => setShowAddForm(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <AddTOTPForm onSuccess={() => setShowAddForm(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthenticatorApp;