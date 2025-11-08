import React, { useState, useEffect, useRef } from 'react';
import { Folder } from '../types';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, ChevronRight, Edit, Trash2, Check, XIcon, Palette, Move, AlertTriangle } from 'lucide-react';

interface FolderItemProps {
  folder: Folder;
  isActive: boolean;
  onSelect: (folderId: string) => void;
  level?: number;
  allFolders: Folder[];
}

const FolderItem: React.FC<FolderItemProps> = ({ folder, isActive, onSelect, level = 0, allFolders }) => {
  const { updateFolder, deleteFolder, moveFolderToFolder } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [newIcon, setNewIcon] = useState(folder.icon);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Références pour détecter les clics en dehors des menus
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const moveOptionsRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Fermer les menus lorsque l'utilisateur clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Fermer le sélecteur de couleur si clic en dehors
      if (showColorPicker && 
          colorPickerRef.current && 
          !colorPickerRef.current.contains(event.target as Node) &&
          colorButtonRef.current &&
          !colorButtonRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
      
      // Fermer le menu de déplacement si clic en dehors
      if (showMoveOptions && 
          moveOptionsRef.current && 
          !moveOptionsRef.current.contains(event.target as Node) &&
          moveButtonRef.current &&
          !moveButtonRef.current.contains(event.target as Node)) {
        setShowMoveOptions(false);
      }
      
      // Fermer le menu de confirmation de suppression si clic en dehors
      if (showDeleteConfirm && 
          deleteConfirmRef.current && 
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
  }, [showColorPicker, showMoveOptions, showDeleteConfirm]);
  
  // Récupérer les sous-dossiers de ce dossier
  const childFolders = allFolders.filter(f => f.parentId === folder.id);

  const predefinedColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6b7280', // gray
    '#000000', // black
  ];

  const predefinedIcons = [
    '📁', '🔒', '🔑', '🏢', '🏠', '🌐', '💼', '🛒', '🏦', '💻', '📱', '🎮'
  ];

  const handleSave = () => {
    if (newName.trim()) {
      updateFolder(folder.id, { 
        name: newName.trim(),
        icon: newIcon
      });
      setIsEditing(false);
      setShowColorPicker(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(folder.name);
      setNewIcon(folder.icon);
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(true);
  };
  
  const handleDelete = () => {
    deleteFolder(folder.id);
    setShowDeleteConfirm(false);
  };

  const toggleExpanded = () => {
    updateFolder(folder.id, { isExpanded: !folder.isExpanded });
  };

  const handleColorSelect = (color: string) => {
    // Mettre à jour la couleur sans fermer le sélecteur
    updateFolder(folder.id, { color });
    // Force le re-rendu de l'interface pour voir les changements immédiatement
    setNewIcon(newIcon); // Cette ligne force un re-rendu du composant
  };

  const handleIconSelect = (icon: string) => {
    setNewIcon(icon);
  };
  
  // Gérer le déplacement d'un dossier vers un autre
  const handleMoveFolder = (targetFolderId: string | null) => {
    if (folder.id !== targetFolderId) {
      moveFolderToFolder(folder.id, targetFolderId);
      setShowMoveOptions(false);
    }
  };
  
  // Vérifier si un dossier est un descendant du dossier actuel
  const isDescendant = (potentialChildId: string): boolean => {
    if (potentialChildId === folder.id) return true;
    const childFolder = allFolders.find(f => f.id === potentialChildId);
    if (!childFolder || !childFolder.parentId) return false;
    return isDescendant(childFolder.parentId);
  };

  // Rendu du composant
  return (
    <>
      <div className={`mb-1 rounded-xl transition-all duration-150 ${
        isActive 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200/50 dark:border-blue-800/50' 
          : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/80'
      }`}>
        <div className="flex items-center p-2.5 group" style={{ paddingLeft: `${level * 16 + 8}px` }}>
          <button 
            onClick={toggleExpanded}
            className="mr-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {folder.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {isEditing ? (
            <div className="flex-1 flex items-center">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center mr-2 cursor-pointer transition-colors"
                onClick={() => setShowColorPicker(!showColorPicker)}
                style={{ 
                  backgroundColor: `${folder.color}20`, // Couleur avec opacité à 20%
                  color: folder.color,
                  borderLeft: `3px solid ${folder.color}`
                }}
              >
                {newIcon || '📁'}
              </div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <button 
                onClick={handleSave}
                className="ml-1 p-1 text-green-500 hover:text-green-600 dark:text-green-400"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setNewName(folder.name);
                  setNewIcon(folder.icon);
                }}
                className="p-1 text-red-500 hover:text-red-600 dark:text-red-400"
              >
                <XIcon size={16} />
              </button>
            </div>
          ) : (
            <>
              <div 
                className="flex items-center flex-1 cursor-pointer"
                onClick={() => onSelect(folder.id)}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center mr-2 transition-colors"
                  style={{ 
                    backgroundColor: `${folder.color}20`, // Couleur avec opacité à 20%
                    color: folder.color,
                    borderLeft: `3px solid ${folder.color}`
                  }}
                >
                  {folder.icon || '📁'}
                </div>
                <span className={`font-medium ${
                  isActive 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {folder.name}
                </span>
              </div>
              
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowColorPicker(false);
                    setShowMoveOptions(false);
                  }}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Edit"
                >
                  <Edit size={14} />
                </button>
                <button
                  ref={colorButtonRef}
                  onClick={() => {
                    setShowColorPicker(!showColorPicker);
                    if (!showColorPicker) setShowMoveOptions(false);
                  }}
                  className={`p-1 ${showColorPicker ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  title="Change appearance"
                >
                  <Palette size={14} />
                </button>
                <button
                  ref={moveButtonRef}
                  onClick={() => {
                    setShowMoveOptions(!showMoveOptions);
                    if (!showMoveOptions) setShowColorPicker(false);
                  }}
                  className={`p-1 ${showMoveOptions ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                  title="Move to folder"
                >
                  <Move size={14} />
                </button>
                <button
                  ref={deleteButtonRef}
                  onClick={confirmDelete}
                  className={`p-1 ${showDeleteConfirm ? 'text-red-600 dark:text-red-400' : 'text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400'}`}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {showColorPicker && (
        <div ref={colorPickerRef} className="p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-xl shadow-xl mb-2 ml-6">
            <div className="mb-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Color</p>
              <div className="flex flex-wrap gap-2">
                {predefinedColors.map(color => (
                  <div
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`w-6 h-6 rounded-full cursor-pointer border ${folder.color === color ? 'border-2 border-white dark:border-white ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Icon</p>
              <div className="flex flex-wrap gap-2">
                {predefinedIcons.map(icon => (
                  <div
                    key={icon}
                    onClick={() => handleIconSelect(icon)}
                    className={`w-8 h-8 flex items-center justify-center rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${newIcon === icon ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500' : ''}`}
                    style={{ color: folder.color }}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-medium transition-all duration-150 shadow-lg shadow-blue-500/25"
              >
                Apply changes
              </button>
            </div>
          </div>
        )}
        
        {showMoveOptions && (
          <div ref={moveOptionsRef} className="p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-xl shadow-xl mb-2 ml-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Move to folder</p>
            
            <div className="max-h-48 overflow-y-auto">
              <div 
                className="p-3 flex items-center rounded-lg cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors duration-150"
                onClick={() => handleMoveFolder(null)}
              >
                <span className="text-gray-700 dark:text-gray-300 font-medium">Root (no folder)</span>
              </div>
              
              {allFolders
                .filter(f => f.id !== folder.id && !isDescendant(f.id))
                .map(f => (
                  <div 
                    key={f.id}
                    className="p-3 flex items-center rounded-lg cursor-pointer hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors duration-150"
                    onClick={() => handleMoveFolder(f.id)}
                  >
                    <div 
                      className="w-6 h-6 rounded-lg flex items-center justify-center mr-2 transition-colors"
                      style={{ 
                        backgroundColor: `${f.color}20`,
                        color: f.color,
                        borderLeft: `3px solid ${f.color}`
                      }}
                    >
                      {f.icon || '📁'}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{f.name}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
      
      {/* Afficher les sous-dossiers de manière récursive si le dossier est étendu */}
      {folder.isExpanded && childFolders.length > 0 && (
        <div className="ml-4">
          {childFolders.map(childFolder => (
            <FolderItem
              key={childFolder.id}
              folder={childFolder}
              isActive={isActive && childFolder.id === folder.id}
              onSelect={onSelect}
              level={level + 1}
              allFolders={allFolders}
            />
          ))}
        </div>
      )}
      
      {/* Menu de confirmation de suppression */}
      {showDeleteConfirm && (
        <>
          {/* Overlay avec effet de flou */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"></div>
          
          {/* Modal de confirmation */}
          <div 
            ref={deleteConfirmRef}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-800/50 z-50 w-[90%] max-w-[400px] animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirm deletion</h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Are you sure you want to delete the folder <span className="font-semibold text-gray-900 dark:text-white">"{folder.name}"</span>? The entries will be moved to the root.
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
        </>
      )}
    </>
  );
};

export default FolderItem;
