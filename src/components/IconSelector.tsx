import React, { useRef, useState } from 'react';
import { X, Image } from 'lucide-react';

interface IconSelectorProps {
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const IconSelector: React.FC<IconSelectorProps> = ({ onSelect, onClose }) => {
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert uploaded image to base64
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file is an image and not too large (max 200KB)
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('Image is too large. Maximum size is 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setCustomImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // Trigger file input click
  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  // Use the custom image
  const selectCustomImage = () => {
    if (customImage) {
      onSelect(customImage);
    }
  };
  // Common service icons
  const icons = [
    '🔐', '🔒', '🔑', '📱', '💻', '🌐', '📧', '🏦', '💳', '🛒', '🎮', '📝',
    '🔍', '🗂️', '📊', '☁️', '🔄', '⚙️', '🎬', '🎵', '📚', '🖥️', '📇', '🎨',
    '🏢', '🌍', '🔔', '📢', '📈', '👤', '👥', '📁', '📂', '🔖', '🔗',
    '📌', '📍', '🛡️', '🔰', '🚫', '⚠️'
  ];

  // Popular services with specific icons
  const services = [
    { name: 'Google', icon: '🔎' },
    { name: 'Apple', icon: '🍎' },
    { name: 'Microsoft', icon: '🪟' },
    { name: 'Facebook', icon: '📘' },
    { name: 'Twitter', icon: '🐦' },
    { name: 'Instagram', icon: '📷' },
    { name: 'Amazon', icon: '📦' },
    { name: 'GitHub', icon: '🐱' },
    { name: 'Dropbox', icon: '📦' },
    { name: 'Slack', icon: '💬' },
    { name: 'PayPal', icon: '💸' },
    { name: 'Netflix', icon: '🎬' },
    { name: 'Spotify', icon: '🎵' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[9998]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select an Icon</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Custom image upload */}
          <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Image</h4>
            <div className="flex flex-col items-center w-full">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />

              {customImage ? (
                <div className="flex flex-col items-center gap-2 mb-3 w-full">
                  <div className="w-24 h-24 border border-gray-200 dark:border-gray-700 rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-gray-700">
                    <img src={customImage} alt="Custom icon" className="w-full h-full object-cover object-center" />
                  </div>
                  <button
                    onClick={selectCustomImage}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                  >
                    Use This Image
                  </button>
                </div>
              ) : (
                <button
                  onClick={openFileSelector}
                  className="flex flex-col items-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full mx-auto max-w-xs"
                >
                  <Image className="w-8 h-8 text-gray-500 dark:text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Upload Custom Icon
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                    PNG, JPG up to 3MB
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Popular Services</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {services.map((service) => (
                <button
                  key={service.name}
                  onClick={() => onSelect(service.icon)}
                  className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="text-2xl mb-1">{service.icon}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate w-full text-center">
                    {service.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Generic Icons</h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {icons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => onSelect(icon)}
                  className="p-3 text-2xl border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconSelector;