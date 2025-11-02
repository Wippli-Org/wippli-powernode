import { useState, useEffect } from 'react';
import {
  HardDrive,
  Cloud,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
  File,
  FileText,
  Image as ImageIcon,
  FileArchive,
  AlertCircle,
  Search,
  Filter,
  X,
  Eye,
  ExternalLink
} from 'lucide-react';

interface StorageFile {
  name: string;
  size: number;
  lastModified: string;
  type?: string;
  url?: string;
  path?: string;
  id?: string;
}

interface StorageProvider {
  name: string;
  icon: any;
  enabled: boolean;
  connected: boolean;
  totalSize?: number;
  usedSize?: number;
  fileCount?: number;
}

type StorageType = 'blob' | 'onedrive' | 'googledrive';

export default function StoragePage() {
  const [activeTab, setActiveTab] = useState<StorageType>('blob');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Storage providers configuration
  const [providers, setProviders] = useState<Record<StorageType, StorageProvider>>({
    blob: {
      name: 'Azure Blob Storage',
      icon: HardDrive,
      enabled: true,
      connected: false,
    },
    onedrive: {
      name: 'Microsoft OneDrive',
      icon: Cloud,
      enabled: false,
      connected: false,
    },
    googledrive: {
      name: 'Google Drive',
      icon: Cloud,
      enabled: false,
      connected: false,
    },
  });

  useEffect(() => {
    loadFiles();
    checkConnections();
  }, [activeTab]);

  const checkConnections = async () => {
    try {
      const response = await fetch(`/api/storage/${activeTab}/status`);
      if (response.ok) {
        const data = await response.json();
        setProviders(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            connected: data.connected,
            totalSize: data.totalSize,
            usedSize: data.usedSize,
            fileCount: data.fileCount,
          }
        }));
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/storage/${activeTab}/list`);
      if (!response.ok) {
        throw new Error(`Failed to load files: ${response.statusText}`);
      }
      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/storage/${activeTab}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: StorageFile) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;

    setError(null);
    try {
      const response = await fetch(`/api/storage/${activeTab}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileId: file.id }),
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }

      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleDownload = async (file: StorageFile) => {
    try {
      const response = await fetch(`/api/storage/${activeTab}/download?fileName=${encodeURIComponent(file.name)}&fileId=${file.id || ''}`);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Download failed');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return ImageIcon;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return FileArchive;
    if (['doc', 'docx', 'txt', 'pdf'].includes(ext || '')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' ||
      (filterType === 'documents' && /\.(doc|docx|pdf|txt)$/i.test(file.name)) ||
      (filterType === 'images' && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file.name)) ||
      (filterType === 'archives' && /\.(zip|rar|7z|tar|gz)$/i.test(file.name));
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Storage Management</h1>
          <p className="text-gray-600 mt-2">Manage files across Azure Blob, OneDrive, and Google Drive</p>
        </div>

        {/* Storage Provider Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(Object.keys(providers) as StorageType[]).map((type) => {
                const provider = providers[type];
                const Icon = provider.icon;
                const isActive = activeTab === type;

                return (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    disabled={!provider.enabled}
                    className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary text-primary bg-blue-50'
                        : provider.enabled
                        ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        : 'border-transparent text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    {provider.name}
                    {provider.connected && (
                      <span className="ml-2 w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Provider Stats */}
          {providers[activeTab].connected && (
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600">Total Files</p>
                  <p className="text-2xl font-bold text-gray-900">{providers[activeTab].fileCount || 0}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600">Used Storage</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatFileSize(providers[activeTab].usedSize || 0)}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600">Total Storage</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {providers[activeTab].totalSize ? formatFileSize(providers[activeTab].totalSize!) : 'Unlimited'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Files</option>
                <option value="documents">Documents</option>
                <option value="images">Images</option>
                <option value="archives">Archives</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadFiles}
                disabled={loading}
                className="flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <label className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50">
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload File'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading || !providers[activeTab].connected}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Connection Warning */}
        {!providers[activeTab].connected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-800 font-medium">Not Connected</p>
              <p className="text-yellow-700 text-sm">
                {activeTab === 'blob' && 'Azure Blob Storage credentials not configured. Please check your environment variables.'}
                {activeTab === 'onedrive' && 'OneDrive integration not yet implemented. Coming soon!'}
                {activeTab === 'googledrive' && 'Google Drive integration not yet implemented. Coming soon!'}
              </p>
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="ml-3 text-gray-600">Loading files...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No files found</p>
              <p className="text-gray-500 text-sm mt-1">
                {searchTerm || filterType !== 'all' ? 'Try adjusting your filters' : 'Upload a file to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Modified</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredFiles.map((file, index) => {
                    const FileIcon = getFileIcon(file.name);
                    return (
                      <tr key={index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FileIcon className="w-5 h-5 text-gray-400 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{file.name}</div>
                              {file.path && <div className="text-xs text-gray-500">{file.path}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(file.lastModified)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {file.url && (
                              <button
                                onClick={() => window.open(file.url, '_blank')}
                                className="text-blue-600 hover:text-blue-900"
                                title="Open in browser"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(file)}
                              className="text-green-600 hover:text-green-900"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(file)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* File Count Summary */}
        {!loading && filteredFiles.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 text-center">
            Showing {filteredFiles.length} of {files.length} files
          </div>
        )}
      </div>
    </div>
  );
}
