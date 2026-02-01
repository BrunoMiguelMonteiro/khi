import { useState } from 'react';
import { X, Download, Sun, Monitor, Moon, Grid3x3, List, FolderOpen, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'export' | 'appearance';

// Custom Checkbox Component
function CustomCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={`w-4 h-4 rounded border-2 transition-all ${
          checked
            ? 'bg-neutral-900 dark:bg-neutral-100 border-neutral-900 dark:border-neutral-100'
            : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'
        }`}>
          {checked && (
            <Check className="w-3 h-3 text-white dark:text-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={3} />
          )}
        </div>
      </div>
      <span className="text-sm group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

// Custom Radio Component
function CustomRadio({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          type="radio"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
          checked
            ? 'border-neutral-900 dark:border-neutral-100'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}>
          {checked && (
            <div className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />
          )}
        </div>
      </div>
      <span className="text-sm group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('export');
  
  // Export settings
  const [exportPath, setExportPath] = useState('~/Documents/Kobo Highlights');
  const [metadata, setMetadata] = useState({
    author: true,
    publisher: true,
    language: true,
    isbn: true,
    lastReadDate: true,
    description: false,
  });
  const [dateFormat, setDateFormat] = useState<'dmy' | 'text' | 'iso'>('iso');
  
  // Appearance settings
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const handleMetadataToggle = (key: keyof typeof metadata) => {
    setMetadata(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetDefaults = () => {
    if (activeTab === 'export') {
      setExportPath('~/Documents/Kobo Highlights');
      setMetadata({
        author: true,
        publisher: true,
        language: true,
        isbn: true,
        lastReadDate: true,
        description: false,
      });
      setDateFormat('iso');
    } else {
      setTheme('system');
      setViewMode('list');
    }
  };

  const handleSaveChanges = () => {
    // TODO: Save settings
    onClose();
  };

  const handleBrowseFolder = () => {
    // TODO: Implement Tauri dialog to select folder
    // In Tauri, you would use:
    // import { open } from '@tauri-apps/api/dialog';
    // const selected = await open({ directory: true, multiple: false });
    // if (selected) setExportPath(selected);
    console.log('Browse folder clicked');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 px-6 pt-6 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export</span>
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
              activeTab === 'appearance'
                ? 'border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-white'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sun className="w-4 h-4" />
            <span className="text-sm font-medium">Appearance</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'export' ? (
            <div className="space-y-8">
              {/* Export Folder */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Export Folder</h3>
                <div>
                  <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-2">Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={exportPath}
                      readOnly
                      className="flex-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-600 dark:text-neutral-400 focus:outline-none text-[14px] cursor-default"
                    />
                    <button
                      onClick={handleBrowseFolder}
                      className="flex items-center gap-2 px-4 py-2.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded-lg transition-colors text-[14px] font-medium whitespace-nowrap"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                    Markdown files will be saved in this folder.
                  </p>
                </div>
              </div>

              {/* Metadata to Include */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Metadata to Include</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                  Select which metadata to include in the exported files.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <CustomCheckbox
                    checked={metadata.author}
                    onChange={() => handleMetadataToggle('author')}
                    label="Author"
                  />
                  <CustomCheckbox
                    checked={metadata.isbn}
                    onChange={() => handleMetadataToggle('isbn')}
                    label="ISBN"
                  />
                  <CustomCheckbox
                    checked={metadata.publisher}
                    onChange={() => handleMetadataToggle('publisher')}
                    label="Publisher"
                  />
                  <CustomCheckbox
                    checked={metadata.lastReadDate}
                    onChange={() => handleMetadataToggle('lastReadDate')}
                    label="Last Read Date"
                  />
                  <CustomCheckbox
                    checked={metadata.language}
                    onChange={() => handleMetadataToggle('language')}
                    label="Language"
                  />
                  <CustomCheckbox
                    checked={metadata.description}
                    onChange={() => handleMetadataToggle('description')}
                    label="Description"
                  />
                </div>
              </div>

              {/* Date Format */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Date Format</h3>
                <div className="space-y-2.5">
                  <CustomRadio
                    checked={dateFormat === 'dmy'}
                    onChange={() => setDateFormat('dmy')}
                    label="DD/MM/YYYY (24/01/2025)"
                  />
                  <CustomRadio
                    checked={dateFormat === 'text'}
                    onChange={() => setDateFormat('text')}
                    label="24 January 2025"
                  />
                  <CustomRadio
                    checked={dateFormat === 'iso'}
                    onChange={() => setDateFormat('iso')}
                    label="ISO 8601 (2025-01-24)"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Theme */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Theme</h3>
                <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors border-r border-neutral-200 dark:border-neutral-700 text-[14px] ${
                      theme === 'system'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    System
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors border-r border-neutral-200 dark:border-neutral-700 text-[14px] ${
                      theme === 'light'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors text-[14px] ${
                      theme === 'dark'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                </div>
              </div>

              {/* Library View Mode */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Library View Mode</h3>
                <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors border-r border-neutral-200 dark:border-neutral-700 text-[14px] ${
                      viewMode === 'grid'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Grid3x3 className="w-4 h-4" />
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-3 py-2 transition-colors text-[14px] ${
                      viewMode === 'list'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            Reset Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="px-4 py-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black text-sm font-medium rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}