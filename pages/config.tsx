import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { RefreshCw, Save, Eye, EyeOff, AlertCircle, CheckCircle, ExternalLink, Check, Send, MessageSquare, Cloud } from 'lucide-react';
import OneDriveConfigModal from '../components/OneDriveConfigModal';
import { getInstanceConfig } from '../lib/instance-config';

interface AIProvider {
  enabled: boolean;
  apiKey: string;
  model: string;
  endpoint?: string;
}

interface PowerNodeConfig {
  providers: {
    openai?: AIProvider;
    anthropic?: AIProvider;
    google?: AIProvider;
    mistral?: AIProvider;
    azureOpenAI?: AIProvider & { deployment?: string };
  };
  defaultProvider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'azureOpenAI';
  powerNodeStorageConnection: string;
  azureStorageAccount: string;
  temperature: number;
  maxTokens: number;
  customPrompts: {
    downloadWippliFile?: string;
    queryVectorDatabase?: string;
    populateDocumentTemplate?: string;
    convertToPdf?: string;
    postWippliComment?: string;
  };
}

const providerInfo = {
  openai: {
    name: 'OpenAI',
    getKeyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    name: 'Google AI',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
  },
  mistral: {
    name: 'Mistral AI',
    getKeyUrl: 'https://console.mistral.ai/api-keys/',
  },
  azureOpenAI: {
    name: 'Azure OpenAI',
    getKeyUrl: 'https://portal.azure.com',
  },
};

export default function ConfigPage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string>(() => {
    // Initialize from instance config on mount
    if (typeof window !== 'undefined') {
      const instanceConfig = getInstanceConfig();
      return instanceConfig.supplierId || 'default-user';
    }
    return 'default-user';
  });

  const [config, setConfig] = useState<PowerNodeConfig>({
    providers: {
      openai: { enabled: false, apiKey: '', model: 'gpt-4o' },
      anthropic: { enabled: false, apiKey: '', model: 'claude-3-5-sonnet-20241022' },
      google: { enabled: false, apiKey: '', model: 'gemini-2.0-flash-exp' },
      mistral: { enabled: false, apiKey: '', model: 'mistral-large-latest' },
      azureOpenAI: { enabled: false, apiKey: '', model: 'gpt-4o', endpoint: '', deployment: '' },
    },
    defaultProvider: 'openai',
    powerNodeStorageConnection: '',
    azureStorageAccount: 'powernodeexecutions',
    temperature: 0.7,
    maxTokens: 4096,
    customPrompts: {},
  });

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);

  // Dynamic models state
  const [providerModels, setProviderModels] = useState<Record<string, any[]>>({});
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});

  // Test chat state
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Load supplierId from instance config (auto-detects from URL or localStorage)
  useEffect(() => {
    const instanceConfig = getInstanceConfig();
    if (instanceConfig.supplierId) {
      setSupplierId(instanceConfig.supplierId);
    }
  }, []);

  useEffect(() => {
    if (supplierId) {
      loadConfig();
    }
  }, [supplierId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`/api/config?creatorId=${encodeURIComponent(supplierId)}`);
      if (response.ok) {
        const data = await response.json();

        // Merge providers properly - if API returns empty providers, use defaults
        const mergedProviders = {
          ...config.providers,
          ...(data.providers && Object.keys(data.providers).length > 0 ? data.providers : {}),
        };

        setConfig({
          ...config,
          ...data,
          providers: mergedProviders,
        });
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
      const response = await fetch(`/api/config?creatorId=${encodeURIComponent(supplierId)}`, {
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

  const updateProvider = (provider: keyof typeof config.providers, updates: any) => {
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        [provider]: { ...config.providers[provider], ...updates },
      },
    });
  };

  const fetchProviderModels = async (provider: keyof typeof config.providers) => {
    const providerConfig = config.providers[provider];
    if (!providerConfig || !providerConfig.apiKey) {
      return;
    }

    setLoadingModels({ ...loadingModels, [provider]: true });

    try {
      let url = `/api/models/${provider}?apiKey=${encodeURIComponent(providerConfig.apiKey)}`;

      // Azure needs endpoint too
      if (provider === 'azureOpenAI' && (providerConfig as any).endpoint) {
        url += `&endpoint=${encodeURIComponent((providerConfig as any).endpoint)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.models) {
        setProviderModels({ ...providerModels, [provider]: data.models });
      } else if (data.fallback) {
        setProviderModels({ ...providerModels, [provider]: data.fallback });
      }
    } catch (error) {
      console.error(`Failed to fetch ${provider} models:`, error);
    } finally {
      setLoadingModels({ ...loadingModels, [provider]: false });
    }
  };

  const testChat = async () => {
    if (!testMessage.trim()) return;

    setTestLoading(true);
    setTestError(null);
    setTestResponse('');

    try {
      // Find the default provider
      const provider = config.defaultProvider;
      const providerConfig = config.providers[provider];

      if (!providerConfig || !providerConfig.enabled || !providerConfig.apiKey) {
        throw new Error('Please enable and configure the default provider first');
      }

      const response = await fetch('/api/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: providerConfig.apiKey,
          model: providerConfig.model,
          message: testMessage,
          endpoint: (providerConfig as any).endpoint,
          deployment: (providerConfig as any).deployment,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      setTestResponse(data.reply);
    } catch (error: any) {
      setTestError(error.message || 'Failed to test chat');
    } finally {
      setTestLoading(false);
    }
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

  const renderProviderCard = (
    providerKey: keyof typeof config.providers,
    info: typeof providerInfo.openai
  ) => {
    const provider = config.providers[providerKey];
    if (!provider) return null;

    return (
      <div
        key={providerKey}
        className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
          provider.enabled ? 'border-primary' : 'border-gray-200'
        } p-6`}
      >
        {/* Header with toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
            {provider.enabled && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                ENABLED
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <a
              href={info.getKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Get API Key <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={() => updateProvider(providerKey, { enabled: !provider.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                provider.enabled ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  provider.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {provider.enabled && (
          <div className="space-y-4">
            {/* API Key */}
            {renderSecretInput(
              'API Key',
              provider.apiKey,
              (val) => updateProvider(providerKey, { apiKey: val }),
              `${providerKey}_apiKey`
            )}

            {/* Azure-specific fields */}
            {providerKey === 'azureOpenAI' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Endpoint URL</label>
                  <input
                    type="text"
                    value={(provider as any).endpoint || ''}
                    onChange={(e) => updateProvider(providerKey, { endpoint: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="https://your-resource.openai.azure.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deployment Name</label>
                  <input
                    type="text"
                    value={(provider as any).deployment || ''}
                    onChange={(e) => updateProvider(providerKey, { deployment: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="gpt-4o"
                  />
                </div>
              </>
            )}

            {/* Fetch Models Button */}
            <button
              onClick={() => fetchProviderModels(providerKey)}
              disabled={!provider.apiKey || loadingModels[providerKey]}
              className="w-full px-4 py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loadingModels[providerKey] ? 'animate-spin' : ''}`} />
              {loadingModels[providerKey] ? 'Fetching Models...' : 'Fetch Latest Models from API'}
            </button>

            {/* Model Input - Text field to type any model name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={provider.model}
                onChange={(e) => updateProvider(providerKey, { model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                placeholder="e.g., claude-sonnet-4-5, gpt-4o, gemini-2.5-pro"
              />
              <p className="text-xs text-gray-500 mt-1">
                Type or paste any model name from {info.name}
              </p>
            </div>

            {/* Model Selection Dropdown (if models fetched) */}
            {providerModels[providerKey] && providerModels[providerKey].length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or select from fetched models ({providerModels[providerKey].length} available)
                </label>
                <select
                  value={provider.model}
                  onChange={(e) => updateProvider(providerKey, { model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  {providerModels[providerKey].map((model: any) => (
                    <option key={model.id} value={model.id}>
                      {model.name || model.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-green-600 mt-1">✓ Fetched live from {info.name} API</p>
              </div>
            )}

            {/* Set as Default */}
            <button
              onClick={() => setConfig({ ...config, defaultProvider: providerKey as any })}
              className={`w-full px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                config.defaultProvider === providerKey
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {config.defaultProvider === providerKey && <Check className="w-4 h-4" />}
              {config.defaultProvider === providerKey ? 'Default Provider' : 'Set as Default'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">PowerNode Configuration</h1>
          <p className="text-gray-600">
            Configure AI providers with your own API keys - enable the providers you want to use
          </p>
          {supplierId !== 'default-user' && (
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200">
              <span className="text-sm font-medium text-blue-800">Configuring for: {supplierId}</span>
            </div>
          )}
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

        {/* AI Providers Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">AI Providers</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderProviderCard('openai', providerInfo.openai)}
            {renderProviderCard('anthropic', providerInfo.anthropic)}
            {renderProviderCard('google', providerInfo.google)}
            {renderProviderCard('mistral', providerInfo.mistral)}
            {renderProviderCard('azureOpenAI', providerInfo.azureOpenAI)}
          </div>
        </div>

        {/* Global Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Global AI Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </div>
        </div>

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

        {/* OneDrive Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Cloud className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-semibold text-gray-900">OneDrive Configuration</h2>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Configure OneDrive OAuth credentials for file operations
              </p>
            </div>
            <button
              onClick={() => setShowOneDriveModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Configure OneDrive
            </button>
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

        {/* Test Chat */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Test Chat</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Send a test message to verify your AI configuration is working. Uses your default provider.
          </p>

          <div className="space-y-4">
            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && testChat()}
                placeholder="Type a message... (e.g., 'Hello, how are you?')"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={testLoading}
              />
              <button
                onClick={testChat}
                disabled={testLoading || !testMessage.trim()}
                className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {testError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{testError}</p>
              </div>
            )}

            {/* Response */}
            {testResponse && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold text-green-800">Response from AI:</p>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{testResponse}</p>
              </div>
            )}
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

        {/* OneDrive Configuration Modal */}
        <OneDriveConfigModal
          isOpen={showOneDriveModal}
          onClose={() => setShowOneDriveModal(false)}
          userId="default-user"
        />
      </div>
    </div>
  );
}
