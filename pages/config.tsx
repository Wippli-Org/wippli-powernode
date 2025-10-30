import { useState, useEffect } from 'react';
import { RefreshCw, Save, Eye, EyeOff, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

interface PowerNodeConfig {
  openRouterApiKey: string;
  powerNodeStorageConnection: string;
  azureStorageAccount: string;
  defaultModel: string;
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

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
}

export default function ConfigPage() {
  const [config, setConfig] = useState<PowerNodeConfig>({
    openRouterApiKey: '',
    powerNodeStorageConnection: '',
    azureStorageAccount: 'powernodeexecutions',
    defaultModel: 'openai/gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    customPrompts: {},
  });

  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    fetchModels();
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

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('/api/openrouter-models');
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoadingModels(false);
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
            Configure OpenRouter for unified AI access - one API key for all models
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

        {/* OpenRouter Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">OpenRouter API</h2>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Get API Key <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Why OpenRouter?</strong> Access GPT-4o, Claude 3.5 Sonnet, Gemini, Llama, Mistral, and 200+ models with one API key.
              Always up-to-date with the latest models - no hard-coded lists!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {renderSecretInput(
              'OpenRouter API Key',
              config.openRouterApiKey,
              (val) => setConfig({ ...config, openRouterApiKey: val }),
              'openRouterApiKey'
            )}

            {/* AI Model Configuration */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Model</label>
                    <button
                      onClick={fetchModels}
                      disabled={loadingModels}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  <select
                    value={config.defaultModel}
                    onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={loadingModels}
                  >
                    {loadingModels ? (
                      <option>Loading models...</option>
                    ) : models.length === 0 ? (
                      <>
                        <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
                        <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                        <option value="google/gemini-pro-1.5">Google: Gemini Pro 1.5</option>
                        <option value="meta-llama/llama-3.1-70b-instruct">Meta: Llama 3.1 70B</option>
                        <option value="mistralai/mistral-large">Mistral: Large</option>
                      </>
                    ) : (
                      <>
                        <optgroup label="Popular Models">
                          {models.slice(0, 20).map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                        {models.length > 20 && (
                          <optgroup label="All Models">
                            {models.slice(20).map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    )}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {models.length > 0 ? `${models.length} models available` : 'Using default models'}
                  </p>
                </div>

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
