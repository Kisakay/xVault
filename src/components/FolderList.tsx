import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import FolderItem from './FolderItem';
import { Plus, Folder as FolderIcon } from 'lucide-react';

interface FolderListProps {
  activeFolder: string | null;
  onSelectFolder: (folderId: string | null) => void;
}

const FolderList: React.FC<FolderListProps> = ({ activeFolder, onSelectFolder }) => {
  const { folders, addFolder } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      addFolder({
        name: newFolderName.trim(),
        icon: '📁',
        color: '#3b82f6', // Default color
        isExpanded: true
      });
      setNewFolderName('');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewFolderName('');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Folders
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-150"
          title="Add a folder"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-1">
        <div 
          className={`p-3 rounded-xl cursor-pointer flex items-center transition-all duration-150 ${
            activeFolder === null 
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-medium border border-blue-200/50 dark:border-blue-800/50' 
              : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/80 text-gray-700 dark:text-gray-300'
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <FolderIcon size={18} className={`mr-3 ${activeFolder === null ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
          <span>All codes</span>
        </div>

        {isCreating && (
          <div className="p-3 bg-white/60 dark:bg-gray-800/60 border border-gray-200/50 dark:border-gray-700/50 rounded-xl backdrop-blur-sm">
            <div className="flex items-center">
              <span className="mr-2 text-lg">📁</span>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => newFolderName.trim() ? handleCreateFolder() : setIsCreating(false)}
                onKeyDown={handleKeyDown}
                placeholder="Folder name"
                autoFocus
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 text-gray-800 dark:text-gray-200 transition-all duration-200"
              />
            </div>
          </div>
        )}

        {folders
          .filter(folder => !folder.parentId) // N'afficher que les dossiers racine
          .map(folder => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isActive={activeFolder === folder.id}
              onSelect={onSelectFolder}
              allFolders={folders}
            />
          ))
        }
      </div>
    </div>
  );
};

export default FolderList;
