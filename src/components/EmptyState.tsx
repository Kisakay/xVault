import React from 'react';
import { ShieldAlert, PlusCircle } from 'lucide-react';

interface EmptyStateProps {
  onAddNew: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAddNew }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-2xl bg-gradient-to-br from-gray-50/50 to-gray-100/30 dark:from-gray-800/30 dark:to-gray-900/50 border-2 border-dashed border-gray-300/50 dark:border-gray-700/50">
      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mb-6">
        <ShieldAlert className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        No authentication keys yet
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md leading-relaxed">
        Add your first TOTP key to start generating two-factor authentication codes for your accounts.
      </p>
      <button
        onClick={onAddNew}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 font-medium"
      >
        <PlusCircle className="w-5 h-5" />
        Add Your First Key
      </button>
    </div>
  );
};

export default EmptyState;