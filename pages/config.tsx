import { useState, useEffect } from 'react';
import { RefreshCw, Save, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

interface PowerNodeConfig {
  // AI Provider Configuration
  aiProvider: 'azure' | 'anthropic' | 'mistral';

  // Azure OpenAI
  azureOpenAIEndpoint: string;
  azureOpenAIKey: string;
  azureOpenAIDeployment: string;
  azureOpenAIEmbeddingDeployment: string;
  azureOpenAIApiVersion: string;

  // Anthropic Claude
  anthropicApiKey: string;

  // Mistral
  mistralApiKey: string;

  // Storage Configuration
  powerNodeStorageConnection: string;
  azureStorageAccount: string;

  // AI Configuration
  defaultModel: string;
  temperature: number;
  maxTokens: number;

  // MCP Tool Custom Prompts
  customPrompts: {
    downloadWippliFile?: string;
    queryVectorDatabase?: string;
    populateDocumentTemplate?: string;
    convertToPdf?: string;
    postWippliComment?: string;
  };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<PowerNodeConfig>({
    aiProvider: 'azure',
    azureOpenAIEndpoint: '',
    azureOpenAIKey: '',
    azureOpenAIDeployment: 'gpt-4o-powerdocs',
    azureOpenAIEmbeddingDeployment: 'text-embedding-3-large',
    azureOpenAIApiVersion: '2024-08-01-preview',
    anthropicApiKey: '',
    mistralApiKey: '',
    powerNodeStorageConnection: '',
    azureStorageAccount: 'powernodeexecutions',
    defaultModel: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    customPrompts: {},
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        setConfig({ ...config, ...data });
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleSecret = (key: string) => {
    setShowSecrets({ ...showSecrets, [key]: !showSecrets[key] });
  };

  const renderSecretInput = (label: string, value: string, onChange: (val: string) => void, key: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <input
          type={showSecrets[key] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent pr-10"
          placeholder={`Enter ${label.toLowerCase()}`}
        />
        <button
          type="button"
          onClick={() => toggleSecret(key)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showSecrets[key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PowerNode Configuration</h1>
          <p className="text-gray-600">
            Configure AI providers, storage, and custom prompts for MCP tools
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {saved && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-800 font-medium">Configuration saved successfully!</p>
          </div>
        )}

        {/* AI Provider Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Provider</h2>
          <div className="grid grid-cols-3 gap-4">
            {(['azure', 'anthropic', 'mistral'] as const).map((provider) => (
              <button
                key={provider}
                onClick={() => setConfig({ ...config, aiProvider: provider })}
                className={`p-4 border-2 rounded-lg text-center transition-colors ${
                  config.aiProvider === provider
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="font-semibold capitalize">{provider}</div>
                <div className="text-xs mt-1 opacity-70">
                  {provider === 'azure' && 'GPT-4o, GPT-4 Turbo'}
                  {provider === 'anthropic' && 'Claude Sonnet 3.5'}
                  {provider === 'mistral' && 'Mistral Large 2'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Azure OpenAI Configuration */}
        {config.aiProvider === 'azure' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Azure OpenAI Configuration</h2>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint</label>
                <input
                  type="text"
                  value={config.azureOpenAIEndpoint}
                  onChange={(e) => setConfig({ ...config, azureOpenAIEndpoint: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="https://australiaeast.api.cognitive.microsoft.com/"
                />
              </div>
              {renderSecretInput(
                'API Key',
                config.azureOpenAIKey,
                (val) => setConfig({ ...config, azureOpenAIKey: val }),
                'azureOpenAIKey'
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deployment Name</label>
                <input
                  type="text"
                  value={config.azureOpenAIDeployment}
                  onChange={(e) => setConfig({ ...config, azureOpenAIDeployment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="gpt-4o-powerdocs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Embedding Deployment
                </label>
                <input
                  type="text"
                  value={config.azureOpenAIEmbeddingDeployment}
                  onChange={(e) => setConfig({ ...config, azureOpenAIEmbeddingDeployment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="text-embedding-3-large"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Version</label>
                <input
                  type="text"
                  value={config.azureOpenAIApiVersion}
                  onChange={(e) => setConfig({ ...config, azureOpenAIApiVersion: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="2024-08-01-preview"
                />
              </div>

              {/* AI Model Configuration for Azure */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = deterministic, 2 = creative</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="200000"
                      step="100"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <select
                      value={config.defaultModel}
                      onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4o-mini">GPT-4o mini</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="o1-preview">O1 Preview</option>
                      <option value="o1-mini">O1 mini</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Anthropic Configuration */}
        {config.aiProvider === 'anthropic' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Anthropic Claude Configuration</h2>
            <div className="grid grid-cols-1 gap-6">
              {renderSecretInput(
                'Anthropic API Key',
                config.anthropicApiKey,
                (val) => setConfig({ ...config, anthropicApiKey: val }),
                'anthropicApiKey'
              )}

              {/* AI Model Configuration for Anthropic */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = deterministic, 1 = creative</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="200000"
                      step="100"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <select
                      value={config.defaultModel}
                      onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Oct 2024)</option>
                      <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet (June 2024)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                      <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mistral Configuration */}
        {config.aiProvider === 'mistral' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Mistral AI Configuration</h2>
            <div className="grid grid-cols-1 gap-6">
              {renderSecretInput(
                'Mistral API Key',
                config.mistralApiKey,
                (val) => setConfig({ ...config, mistralApiKey: val }),
                'mistralApiKey'
              )}

              {/* AI Model Configuration for Mistral */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = deterministic, 1 = creative</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="200000"
                      step="100"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                    <select
                      value={config.defaultModel}
                      onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="mistral-large-latest">Mistral Large (Latest)</option>
                      <option value="mistral-large-2411">Mistral Large 2 (Nov 2024)</option>
                      <option value="mistral-large-2407">Mistral Large 2 (July 2024)</option>
                      <option value="mistral-small-latest">Mistral Small (Latest)</option>
                      <option value="codestral-latest">Codestral (Latest)</option>
                      <option value="ministral-8b-latest">Ministral 8B</option>
                      <option value="ministral-3b-latest">Ministral 3B</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Storage Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Storage Configuration</h2>
          <div className="grid grid-cols-1 gap-6">
            {renderSecretInput(
              'PowerNode Storage Connection String',
              config.powerNodeStorageConnection,
              (val) => setConfig({ ...config, powerNodeStorageConnection: val }),
              'powerNodeStorageConnection'
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Storage Account Name</label>
              <input
                type="text"
                value={config.azureStorageAccount}
                onChange={(e) => setConfig({ ...config, azureStorageAccount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="powernodeexecutions"
              />
            </div>
          </div>
        </div>

        {/* Custom System Prompts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom System Prompts (Optional)</h2>
          <p className="text-sm text-gray-600 mb-6">
            Override the default system prompts for specific MCP tools. Leave empty to use defaults.
          </p>

          <div className="space-y-6">
            {[
              { key: 'downloadWippliFile', label: 'Download Wippli File' },
              { key: 'queryVectorDatabase', label: 'Query Vector Database' },
              { key: 'populateDocumentTemplate', label: 'Populate Document Template' },
              { key: 'convertToPdf', label: 'Convert to PDF' },
              { key: 'postWippliComment', label: 'Post Wippli Comment' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                <textarea
                  value={(config.customPrompts as any)[key] || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      customPrompts: { ...config.customPrompts, [key]: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  placeholder={`Custom system prompt for ${label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <button
            onClick={loadConfig}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Reset
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
