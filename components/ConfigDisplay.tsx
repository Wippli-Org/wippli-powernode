import { Key, Database, Brain, Zap, CheckCircle2 } from 'lucide-react';

interface ConfigDisplayProps {
  config: {
    api_key: string;
    storage_account: string;
    vector_index: string;
    ai_models: string[];
    rate_limit: {
      current: number;
      max: number;
      resets_in_minutes: number;
    };
    mcp_tools_enabled: string[];
  };
}

export default function ConfigDisplay({ config }: ConfigDisplayProps) {
  const rateLimitPercentage = (config.rate_limit.current / config.rate_limit.max) * 100;

  function formatToolName(tool: string) {
    return tool.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="space-y-6">
      {/* API Key & Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Key className="w-4 h-4 text-primary" />
            API Key
          </div>
          <div className="bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm text-gray-900">
            {config.api_key}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Database className="w-4 h-4 text-primary" />
            Storage Account
          </div>
          <div className="bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm text-gray-900">
            {config.storage_account}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Database className="w-4 h-4 text-primary" />
            Vector Index
          </div>
          <div className="bg-gray-100 rounded-lg px-4 py-3 font-mono text-sm text-gray-900">
            {config.vector_index}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            AI Models
          </div>
          <div className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {config.ai_models.map((model) => (
                <span
                  key={model}
                  className="inline-flex items-center px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium"
                >
                  {model}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limit */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          Rate Limit
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {config.rate_limit.current.toLocaleString()} / {config.rate_limit.max.toLocaleString()} calls
            </span>
            <span className="text-xs text-gray-500">
              Resets in {config.rate_limit.resets_in_minutes} min
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                rateLimitPercentage > 80
                  ? 'bg-red-500'
                  : rateLimitPercentage > 50
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              }`}
              style={{ width: `${rateLimitPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* MCP Tools Enabled */}
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          MCP Tools Enabled ({config.mcp_tools_enabled.length})
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {config.mcp_tools_enabled.map((tool) => (
            <div
              key={tool}
              className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
            >
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-gray-900">{formatToolName(tool)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
