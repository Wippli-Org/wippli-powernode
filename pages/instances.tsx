import { useState, useEffect } from 'react';
import {
  getInstanceConfig,
  saveInstanceToAPI,
  listInstancesFromAPI,
  loadInstanceFromAPI,
  type InstanceConfig,
} from '../lib/instance-config';
import { Copy, Check, Download, Plus, Trash2, FileJson, RefreshCw } from 'lucide-react';

function generateInstanceId(): string {
  return `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function Instances() {
  const [instances, setInstances] = useState<InstanceConfig[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<InstanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    const list = await listInstancesFromAPI();
    setInstances(list);
    if (list.length > 0 && !selectedInstance) {
      setSelectedInstance(list[0]);
    }
    setLoading(false);
  };

  const handleNewInstance = () => {
    const newInstance: InstanceConfig = {
      instanceId: generateInstanceId(),
      instanceName: 'New PowerNode Instance',
      supplierId: '',
      n8n: {
        enabled: true,
        apiUrl: '',
        apiKey: '',
      },
      ui: {
        hideNavigation: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedInstance(newInstance);
  };

  const handleSaveInstance = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    const success = await saveInstanceToAPI(selectedInstance);
    if (success) {
      await loadInstances();
      alert('Instance saved successfully!');
    } else {
      alert('Failed to save instance');
    }
    setSaving(false);
  };

  const handleCopyUrl = () => {
    if (!selectedInstance) return;
    const url = `https://powernode.wippli.ai?instanceId=${selectedInstance.instanceId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadN8nNode = () => {
    if (!selectedInstance) return;

    const n8nNode = {
      nodes: [
        {
          parameters: {
            method: 'POST',
            url: `https://powernode.wippli.ai/api/chat-with-mcp?instanceId=${selectedInstance.instanceId}`,
            sendBody: true,
            bodyParameters: {
              parameters: [
                {
                  name: 'message',
                  value: '={{ $json.message || "" }}'
                },
                {
                  name: 'conversationHistory',
                  value: '={{ $json.conversationHistory || [] }}'
                },
                {
                  name: 'fileUrl',
                  value: '={{ $json.fileUrl || "" }}'
                },
                {
                  name: 'fileName',
                  value: '={{ $json.fileName || "" }}'
                },
                {
                  name: 'storageProvider',
                  value: '={{ $json.storageProvider || "onedrive" }}'
                }
              ]
            },
            options: {}
          },
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.2,
          position: [820, 300],
          id: generateInstanceId(),
          name: `PowerNode - ${selectedInstance.instanceName}`
        }
      ],
      connections: {},
      pinData: {}
    };

    const json = JSON.stringify(n8nNode, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `powernode-${selectedInstance.instanceId}-n8n-node.json`;
    a.click();
  };

  if (loading) return <div className="p-6">Loading instances...</div>;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Instance List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewInstance}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Instance
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {instances.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No instances yet. Click "New Instance" to create one.
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {instances.map((instance) => (
                <button
                  key={instance.instanceId}
                  onClick={() => setSelectedInstance(instance)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedInstance?.instanceId === instance.instanceId
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="font-medium text-sm">{instance.instanceName}</div>
                  <div className="text-xs text-gray-500 truncate">{instance.instanceId}</div>
                  {instance.supplierId && (
                    <div className="text-xs text-blue-600 mt-1">Supplier: {instance.supplierId}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={loadInstances}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh List
          </button>
        </div>
      </div>

      {/* Main Content - Instance Editor */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedInstance ? (
          <div className="text-center text-gray-500 mt-20">
            Select an instance from the sidebar or create a new one
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Instance Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold mb-4">Instance Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instance ID
                  </label>
                  <input
                    type="text"
                    value={selectedInstance.instanceId}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instance Name
                  </label>
                  <input
                    type="text"
                    value={selectedInstance.instanceName}
                    onChange={(e) => setSelectedInstance({ ...selectedInstance, instanceName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="My PowerNode Instance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier ID
                  </label>
                  <input
                    type="text"
                    value={selectedInstance.supplierId || ''}
                    onChange={(e) => setSelectedInstance({ ...selectedInstance, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="wippli-prologistik"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">n8n Integration</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        n8n API URL
                      </label>
                      <input
                        type="text"
                        value={selectedInstance.n8n?.apiUrl || ''}
                        onChange={(e) =>
                          setSelectedInstance({
                            ...selectedInstance,
                            n8n: { ...selectedInstance.n8n!, apiUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://n8n-prologistik.wippli.ai/api/v1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        n8n API Key
                      </label>
                      <input
                        type="password"
                        value={selectedInstance.n8n?.apiKey || ''}
                        onChange={(e) =>
                          setSelectedInstance({
                            ...selectedInstance,
                            n8n: { ...selectedInstance.n8n!, apiKey: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveInstance}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Save to Cloud'}
                </button>
              </div>
            </div>

            {/* Usage Instructions */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-500 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-green-900 mb-4">How to Use This Instance in n8n</h2>

              <div className="space-y-4">
                {/* Option 1: Download n8n Node */}
                <div className="bg-white rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-blue-600" />
                    Option 1: Download Pre-configured n8n Node (Recommended)
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Download a ready-to-use n8n HTTP Request node with this instance pre-configured.
                  </p>
                  <button
                    onClick={handleDownloadN8nNode}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download n8n Node JSON
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Import this JSON file in your n8n workflow editor
                  </p>
                </div>

                {/* Option 2: Manual Setup */}
                <div className="bg-white rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase">
                    Option 2: Manual Setup in n8n
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">API Endpoint:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-xs font-mono">
                          https://powernode.wippli.ai/api/chat-with-mcp?instanceId={selectedInstance.instanceId}
                        </code>
                        <button
                          onClick={handleCopyUrl}
                          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-1"
                        >
                          {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      <p className="font-semibold mb-1">Method: POST</p>
                      <p>Send JSON body with: message, conversationHistory, fileUrl, fileName, storageProvider</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
