import { FileText, Folder } from 'lucide-react';

interface StorageViewProps {
  storage: {
    blobs: Array<{
      name: string;
      size: number;
      created: string;
    }>;
    total_size: number;
  };
  wippli_id: number;
}

export default function StorageView({ storage, wippli_id }: StorageViewProps) {
  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'docx' || ext === 'doc') return '📝';
    if (ext === 'xlsx' || ext === 'xls') return '📊';
    return '📁';
  }

  // Group files by folder
  const filesByFolder: Record<string, typeof storage.blobs> = {};

  storage.blobs.forEach((blob) => {
    const parts = blob.name.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';

    if (!filesByFolder[folder]) {
      filesByFolder[folder] = [];
    }
    filesByFolder[folder].push(blob);
  });

  return (
    <div className="space-y-4">
      {/* Total Summary */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">Total Storage</div>
            <div className="text-2xl font-bold text-primary">{formatFileSize(storage.total_size)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Files</div>
            <div className="text-2xl font-bold text-gray-900">{storage.blobs.length}</div>
          </div>
        </div>
      </div>

      {/* Files by Folder */}
      {Object.entries(filesByFolder).map(([folder, files]) => (
        <div key={folder} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Folder className="w-4 h-4 text-primary" />
              {folder === 'root' ? `${wippli_id}/` : `${folder}/`}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {files.map((file, index) => {
              const filename = file.name.split('/').pop() || file.name;

              return (
                <div key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl flex-shrink-0">{getFileIcon(filename)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 truncate">{filename}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(file.created).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 ml-4">{formatFileSize(file.size)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {storage.blobs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No files created yet</p>
        </div>
      )}
    </div>
  );
}
