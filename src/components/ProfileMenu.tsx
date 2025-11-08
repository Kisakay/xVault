import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Save, Camera, Key, Copy, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';

interface ProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, changeUserPassword, deleteUserAccount, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'danger'>('general');
  const [name, setName] = useState(user?.name || '');
  const [logo, setLogo] = useState<string | null>(user?.logo || null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginIdCopied, setLoginIdCopied] = useState(false);
  
  const [generalMessage, setGeneralMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dangerMessage, setDangerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // État pour la boîte de dialogue de confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setLogo(user.logo || null);
    }
  }, [user]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('general');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDeletePassword('');
      setGeneralMessage(null);
      setSecurityMessage(null);
      setDangerMessage(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setLogo(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setGeneralMessage(null);
    
    try {
      const result = await updateProfile({ name, logo: logo || undefined });
      
      if (result.success) {
        setGeneralMessage({ type: 'success', text: 'Profile updated successfully' });
      } else {
        setGeneralMessage({ type: 'error', text: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setGeneralMessage({ type: 'error', text: 'An error occurred while updating profile' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSecurityMessage(null);
    
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'New passwords do not match' });
      setIsLoading(false);
      return;
    }
    
    if (newPassword.length < 6) {
      setSecurityMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      setIsLoading(false);
      return;
    }
    
    try {
      const result = await changeUserPassword(currentPassword, newPassword);
      
      if (result.success) {
        setSecurityMessage({ type: 'success', text: 'Password changed successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setSecurityMessage({ type: 'error', text: result.error || 'Failed to change password' });
      }
    } catch (error) {
      setSecurityMessage({ type: 'error', text: 'An error occurred while changing password' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyLoginId = () => {
    if (user?.loginId) {
      navigator.clipboard.writeText(user.loginId);
      setLoginIdCopied(true);
      setTimeout(() => setLoginIdCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/50 dark:border-gray-800/50 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200/50 dark:border-gray-800/50">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-150"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex border-b border-gray-200/50 dark:border-gray-800/50">
          <button
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 min-w-[100px] transition-all duration-150 ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
            }`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 min-w-[100px] transition-all duration-150 ${
              activeTab === 'security'
                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
            }`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
          <button
            className={`flex-1 py-3 px-4 text-center font-medium border-b-2 min-w-[100px] transition-all duration-150 ${
              activeTab === 'danger'
                ? 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400 bg-red-50/50 dark:bg-red-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
            }`}
            onClick={() => setActiveTab('danger')}
          >
            Danger Zone
          </button>
        </div>
        
        <div className="p-6">
          {activeTab === 'general' && (
            <form onSubmit={handleProfileUpdate}>
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  {logo ? (
                    <img 
                      src={logo} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full object-cover border-4 border-blue-500"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold">
                      {name ? name.charAt(0).toUpperCase() : 'V'}
                    </div>
                  )}
                  <label 
                    htmlFor="logo-upload" 
                    className="absolute bottom-0 right-0 bg-gray-100 dark:bg-gray-700 p-2 rounded-full cursor-pointer border-2 border-white dark:border-gray-800 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Camera className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <input 
                      id="logo-upload" 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </label>
                </div>
                
                <div className="flex items-center mb-2 w-full max-w-xs">
                  <div className="flex-1 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md font-medium text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shadow-sm overflow-x-auto">
                    {user?.loginId || 'No ID'}
                  </div>
                  <button 
                    type="button"
                    onClick={copyLoginId}
                    className="ml-2 p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    {loginIdCopied ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This is your unique login ID. Keep it safe.
                </p>
              </div>
              
              {generalMessage && (
                <div className={`mb-4 p-4 rounded-xl border ${
                  generalMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/30'
                }`}>
                  <p className="font-medium">{generalMessage.text}</p>
                </div>
              )}
              
              <div className="mb-6">
                <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vault Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter vault name"
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          
          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange}>
              {securityMessage && (
                <div className={`mb-4 p-4 rounded-xl border ${
                  securityMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/30'
                }`}>
                  <p className="font-medium">{securityMessage.text}</p>
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="currentPassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter current password"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="newPassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter new password"
                  required
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Password must be at least 6 characters long
                </p>
              </div>
              
              <div className="mb-6">
                <label htmlFor="confirmPassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 dark:focus:border-blue-500 transition-all duration-200"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Changing...' : (
                    <>
                      <Key className="h-4 w-4" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          
          {activeTab === 'danger' && (
            <div>
              {dangerMessage && (
                <div className={`mb-4 p-4 rounded-xl border ${
                  dangerMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/30' 
                    : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800/30'
                }`}>
                  <p className="font-medium">{dangerMessage.text}</p>
                </div>
              )}
              
              <div className="mb-6 p-5 border border-red-200 dark:border-red-800/30 rounded-xl bg-red-50 dark:bg-red-900/20">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Delete Account</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      Deleting your account is permanent. All your data, including your vault entries, will be permanently deleted.
                      This action cannot be undone.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 shadow-lg shadow-red-500/25 font-medium"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Boîte de dialogue de confirmation */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/50 dark:border-gray-800/50 animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center gap-3">
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-red-800 dark:text-red-300">Confirm Account Deletion</h3>
                    </div>
                    
                    <div className="p-6">
                      <p className="mb-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                        Please enter your password to confirm that you want to permanently delete your account.
                      </p>
                      
                      <div className="mb-6">
                        <label htmlFor="deletePassword" className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          Password
                        </label>
                        <input
                          type="password"
                          id="deletePassword"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 dark:focus:border-red-500 transition-all duration-200"
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                      
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeletePassword('');
                          }}
                          className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-150 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!deletePassword) {
                              setDangerMessage({ type: 'error', text: 'Password is required' });
                              return;
                            }
                            
                            setIsLoading(true);
                            setDangerMessage(null);
                            
                            try {
                              const result = await deleteUserAccount(deletePassword);
                              
                              if (result.success) {
                                // Compte supprimé avec succès, fermer le modal et rediriger
                                onClose();
                                await logout();
                                // La redirection se fera automatiquement via le contexte d'authentification
                              } else {
                                setDangerMessage({ type: 'error', text: result.error || 'Failed to delete account' });
                                setShowDeleteConfirm(false);
                              }
                            } catch (error) {
                              setDangerMessage({ type: 'error', text: 'An error occurred while deleting account' });
                              setShowDeleteConfirm(false);
                            } finally {
                              setIsLoading(false);
                              setDeletePassword('');
                            }
                          }}
                          disabled={isLoading || !deletePassword}
                          className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl transition-all duration-200 shadow-lg shadow-red-500/25 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading ? 'Deleting...' : 'Delete My Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileMenu;
