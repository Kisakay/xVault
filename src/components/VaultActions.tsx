import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, AlertCircle, CheckCircle, MoreVertical, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportVault, importVault, ExportedVault } from '../utils/api';

interface VaultActionsProps {
  className?: string;
}

const VaultActions: React.FC<VaultActionsProps> = ({ className }) => {
  const { isLocked, lock } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [password, setPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Reset modal state on close
  const resetState = () => {
    setPassword('');
    setImportPassword('');
    setStatusMessage(null);
    setImportFile(null);
  };

  // Handle export button click
  const handleExportClick = () => {
    setIsExporting(true);
    setMenuOpen(false);
    resetState();
  };

  // Handle export submission
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    try {
      const exportedData = await exportVault(password);

      // Create and download the file
      const dataStr = JSON.stringify(exportedData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(dataBlob);

      const fileName = `xVault-vault-${new Date().toISOString().split('T')[0]}.json`;
      downloadLink.download = fileName;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setStatusMessage({ type: 'success', text: 'Vault exported successfully!' });

      // Clear password after short delay
      setTimeout(() => {
        setPassword('');
      }, 1000);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to export vault'
      });
    }
  };

  // Handle import button click
  const handleImportClick = () => {
    setIsImporting(true);
    setMenuOpen(false);
    resetState();
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setStatusMessage(null);
    }
  };

  // Handle import submission
  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!importFile) {
      setStatusMessage({ type: 'error', text: 'Please select a file to import' });
      return;
    }

    try {
      // Read the file
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const importData = JSON.parse(content) as ExportedVault;

          // Validate file format
          // Only support xVault-V2 format
          if (!importData.format || importData.format !== 'xVault-V2') {
            setStatusMessage({ type: 'error', text: 'Invalid vault file format. Only xVault-V2 format is supported.' });
            return;
          }

          await importVault(importData, importPassword);
          setStatusMessage({ type: 'success', text: 'Vault imported successfully! Please reload the application.' });

          // Clear password after short delay
          setTimeout(() => {
            setImportPassword('');
          }, 1000);
        } catch (parseError) {
          setStatusMessage({ type: 'error', text: 'Failed to parse import file' });
        }
      };

      reader.onerror = () => {
        setStatusMessage({ type: 'error', text: 'Failed to read import file' });
      };

      reader.readAsText(importFile);
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to import vault'
      });
    }
  };

  // Don't display when the vault is locked
  if (isLocked) {
    return null;
  }

  return (
    <div className={className} ref={menuRef}>
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-all duration-200"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-2xl shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 z-10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="py-1.5" role="menu" aria-orientation="vertical">
              <button
                onClick={handleExportClick}
                className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors duration-150"
                role="menuitem"
              >
                <Download className="w-4 h-4 mr-3" />
                Export Vault
              </button>
              <button
                onClick={handleImportClick}
                className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 transition-colors duration-150"
                role="menuitem"
              >
                <Upload className="w-4 h-4 mr-3" />
                Import Vault
              </button>
              <div className="border-t border-gray-100 dark:border-gray-800 my-1"></div>
              <button
                onClick={lock}
                className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/20 transition-colors duration-150"
                role="menuitem"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Lock Vault
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full border border-gray-200/50 dark:border-gray-800/50 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Export Vault</h3>
            </div>

            <form onSubmit={handleExport} className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                Please enter your vault password to export your data. The exported file will be encrypted with this password.
              </p>

              <div className="mb-6">
                <label htmlFor="export-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vault Password
                </label>
                <input
                  id="export-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white transition-all duration-200"
                  placeholder="Enter your vault password"
                  required
                />
              </div>

              {statusMessage && (
                <div className={`p-4 mb-6 rounded-xl flex items-center ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/30'
                  }`}>
                  {statusMessage.type === 'success'
                    ? <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    : <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  }
                  <span className="font-medium">{statusMessage.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsExporting(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-150 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!password}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-150 shadow-lg shadow-blue-500/25 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full border border-gray-200/50 dark:border-gray-800/50 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import Vault</h3>
            </div>

            <form onSubmit={handleImport} className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                Upload a previously exported xVault vault file. You'll need the same password that was used to export the file.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vault File
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="vault-file-input"
                  />
                  <label
                    htmlFor="vault-file-input"
                    className="cursor-pointer px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-150 font-medium flex-shrink-0"
                  >
                    Choose File
                  </label>
                  <span className="flex-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {importFile ? importFile.name : 'No file selected'}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="import-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vault Password
                </label>
                <input
                  id="import-password"
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 dark:text-white transition-all duration-200"
                  placeholder="Enter the password for this vault file"
                  required
                />
              </div>

              {statusMessage && (
                <div className={`p-4 mb-6 rounded-xl flex items-center ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/30'
                  }`}>
                  {statusMessage.type === 'success'
                    ? <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    : <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                  }
                  <span className="font-medium">{statusMessage.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImporting(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all duration-150 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile || !importPassword}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-150 shadow-lg shadow-blue-500/25 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultActions;
