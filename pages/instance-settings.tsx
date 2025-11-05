import { useState, useEffect } from 'react';
import {
  getInstanceConfig,
  saveInstanceConfig,
  updateInstanceConfig,
  exportConfigAsURL,
  isEmbeddedMode,
  saveInstanceToAPI,
  listInstancesFromAPI,
  type InstanceConfig,
} from '../lib/instance-config';
import { Copy, Check, Download, Upload, RefreshCw, Cloud, Plus, FileJson } from 'lucide-react';

export default function InstanceSettings() {
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedInstanceUrl, setCopiedInstanceUrl] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedToCloud, setSavedToCloud] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [hasBeenSavedToCloud, setHasBeenSavedToCloud] = useState(false);
  const [instanceList, setInstanceList] = useState<InstanceConfig[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);

  useEffect(() => {
    setConfig(getInstanceConfig());
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoadingInstances(true);
    const instances = await listInstancesFromAPI();
    setInstanceList(instances);
    setLoadingInstances(false);
  };

  const handleSave = () => {
    if (!config) return;
    saveInstanceConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveToCloud = async () => {
    if (!config) return;
    setSavingToCloud(true);

    try {
      const success = await saveInstanceToAPI(config);
      if (success) {
        setSavedToCloud(true);
        setHasBeenSavedToCloud(true);
        setTimeout(() => setSavedToCloud(false), 2000);
      } else {
        alert('Failed to save instance to cloud. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving to cloud:', error);
      alert('Failed to save instance to cloud. Check console for details.');
    } finally {
      setSavingToCloud(false);
    }
  };

  const handleCopyInstanceUrl = () => {
    if (!config) return;
    const url = `https://powernode.wippli.ai?instanceId=${config.instanceId}`;
    navigator.clipboard.writeText(url);
    setCopiedInstanceUrl(true);
    setTimeout(() => setCopiedInstanceUrl(false), 2000);
  };

  const handleCopyURL = () => {
    if (!config) return;
    const url = exportConfigAsURL(config);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    if (!config) return;
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `powernode-instance-${config.instanceId}.json`;
    a.click();
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        imported.createdAt = new Date(imported.createdAt);
        imported.updatedAt = new Date(imported.updatedAt);
        setConfig(imported);
      } catch (error) {
        alert('Failed to import configuration: Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (confirm('Reset to default configuration? This will clear all instance settings.')) {
      localStorage.removeItem('powernode-instance-config');
      window.location.reload();
    }
  };

  if (!config) return <div>Loading...</div>;

  const embedded = isEmbeddedMode();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">Instance Settings</h1>
          <p className="text-gray-600 mb-4">
            Configure this PowerNode instance for independent operation or n8n embedding
          </p>

          {embedded && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm">
                📌 Running in embedded mode. Configuration is loaded from URL parameters.
              </p>
            </div>
          )}

          {/* Instance Identity */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Instance Identity</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance ID
                </label>
                <input
                  type="text"
                  value={config.instanceId}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Unique identifier for this instance</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance Name
                </label>
                <input
                  type="text"
                  value={config.instanceName}
                  onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
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
                  value={config.supplierId || ''}
                  onChange={(e) => setConfig({ ...config, supplierId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="supplier-123"
                />
                <p className="text-xs text-gray-500 mt-1">Organization/supplier-level isolation for multi-tenant environments</p>
              </div>
            </div>
          </div>

          {/* n8n Configuration */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">n8n Integration</h2>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.n8n?.enabled || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      n8n: { ...config.n8n, enabled: e.target.checked, apiUrl: config.n8n?.apiUrl || '', apiKey: config.n8n?.apiKey || '' },
                    })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Enable n8n integration
                </label>
              </div>

              {config.n8n?.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      n8n API URL
                    </label>
                    <input
                      type="text"
                      value={config.n8n?.apiUrl || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          n8n: { ...config.n8n!, apiUrl: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://n8n.example.com/api/v1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      n8n API Key
                    </label>
                    <input
                      type="password"
                      value={config.n8n?.apiKey || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          n8n: { ...config.n8n!, apiKey: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="n8n_api_xxxxxxxxxxxx"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* UI Configuration */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">UI Configuration</h2>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.ui?.hideNavigation || false}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      ui: { ...config.ui, hideNavigation: e.target.checked },
                    })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Hide navigation (for embedding)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enabled Pages (comma-separated)
                </label>
                <input
                  type="text"
                  value={config.ui?.enabledPages?.join(',') || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      ui: {
                        ...config.ui,
                        enabledPages: e.target.value.split(',').filter((p) => p.trim()),
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="workflows,mcp-tools,executions"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to enable all pages
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
            >
              {saved ? <Check className="w-4 h-4" /> : null}
              {saved ? 'Saved!' : 'Save Locally'}
            </button>

            <button
              onClick={handleSaveToCloud}
              disabled={savingToCloud}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savedToCloud ? <Check className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
              {savingToCloud ? 'Saving...' : savedToCloud ? 'Saved to Cloud!' : 'Save to Cloud'}
            </button>

            <button
              onClick={handleCopyURL}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Embed URL'}
            </button>

            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>

            <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset to Default
            </button>
          </div>
        </div>

        {/* HOW TO USE - Prominently displayed after save */}
        {hasBeenSavedToCloud && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-green-900 mb-4 flex items-center gap-2">
              <Check className="w-6 h-6" />
              Instance Saved! Ready to Use in n8n
            </h2>

            <div className="bg-white rounded-lg p-4 mb-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase">
                Step 1: Copy This URL
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={`https://powernode.wippli.ai?instanceId=${config.instanceId}`}
                  readOnly
                  className="flex-1 px-3 py-2 border-2 border-green-500 rounded-md bg-green-50 font-mono text-sm"
                />
                <button
                  onClick={handleCopyInstanceUrl}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 whitespace-nowrap"
                >
                  {copiedInstanceUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedInstanceUrl ? 'Copied!' : 'Copy URL'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase">
                Step 2: Paste in n8n
              </h3>
              <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
                <li>Open your n8n workflow</li>
                <li>Add an <strong>HTTP Request</strong> node or browser/iframe node</li>
                <li>Paste the URL above as the target</li>
                <li>PowerNode will automatically load your saved configuration!</li>
              </ul>
              <p className="text-xs text-green-700 mt-3 bg-green-100 p-2 rounded">
                Your n8n API credentials are securely stored in Azure - no need to pass them in the URL!
              </p>
            </div>
          </div>
        )}

        {/* Usage Examples */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-3">Usage Examples</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Embed in n8n (URL Parameters)
              </h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                {exportConfigAsURL(config)}
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Embed in iframe (Hide Navigation)
              </h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
{`<iframe
  src="${window.location.origin}?instanceId=${config.instanceId}&hideNav=true"
  width="100%"
  height="800px"
  frameborder="0"
></iframe>`}
              </pre>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Multiple Instances with Different n8n Configs
              </h3>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
{`// Production Instance
${window.location.origin}?n8nApiUrl=https://prod.n8n.com/api/v1&n8nApiKey=prod_key

// Staging Instance
${window.location.origin}?n8nApiUrl=https://staging.n8n.com/api/v1&n8nApiKey=staging_key`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
