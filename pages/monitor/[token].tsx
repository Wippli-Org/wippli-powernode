import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Database,
  Cpu,
  DollarSign,
  Settings,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

import LogEntry from '../../components/LogEntry';
import StorageView from '../../components/StorageView';
import ConfigDisplay from '../../components/ConfigDisplay';
import CostBreakdown from '../../components/CostBreakdown';

// TypeScript interfaces
interface ExecutionData {
  execution_id: string;
  wippli_id: number;
  creator_id: string;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed';
  duration_ms?: number;
}

interface LogEntryData {
  timestamp: string;
  tool: string;
  input: any;
  output: any;
  duration_ms: number;
  status: 'success' | 'failed';
  cost?: number;
}

interface StorageData {
  blobs: Array<{
    name: string;
    size: number;
    created: string;
  }>;
  total_size: number;
}

interface ConfigData {
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
}

interface WippliIntegration {
  task_url: string;
  proof_url?: string;
  comment_posted: boolean;
  finals_uploaded: boolean;
}

export default function MonitorPage() {
  const router = useRouter();
  const { token } = router.query;

  const [execution, setExecution] = useState<ExecutionData | null>(null);
  const [logs, setLogs] = useState<LogEntryData[]>([]);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [wippliIntegration, setWippliIntegration] = useState<WippliIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetchExecutionData();

    // Auto-refresh every 2 seconds if execution is running
    let interval: NodeJS.Timeout;
    if (autoRefresh && execution?.status === 'running') {
      interval = setInterval(fetchExecutionData, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, autoRefresh, execution?.status]);

  async function fetchExecutionData() {
    try {
      const res = await fetch(`/api/monitoring/${token}`);

      if (!res.ok) {
        if (res.status === 404) {
          setError('Execution not found or expired');
        } else {
          setError('Failed to load execution data');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      setExecution(data.execution);
      setLogs(data.logs);
      setStorage(data.storage);
      setConfig(data.config);
      setWippliIntegration(data.wippli_integration);
      setLoading(false);
    } catch (err) {
      setError('Failed to fetch execution data');
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            Completed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 animate-pulse">
            <Clock className="w-4 h-4" />
            Running
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
      default:
        return <span className="text-gray-500">{status}</span>;
    }
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading execution data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!execution) {
    return null;
  }

  const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PowerNode Execution Monitor</h1>
              <p className="mt-1 text-sm text-gray-500 font-mono">{token}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  autoRefresh
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${autoRefresh && execution.status === 'running' ? 'animate-spin' : ''}`} />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Execution Metadata */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <FileText className="w-4 h-4" />
                Wippli Task
              </div>
              <div className="text-2xl font-bold text-gray-900">#{execution.wippli_id}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Database className="w-4 h-4" />
                Creator
              </div>
              <div className="text-lg font-semibold text-gray-900">{execution.creator_id}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                Started
              </div>
              <div className="text-sm font-medium text-gray-900">
                {formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Cpu className="w-4 h-4" />
                Duration
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {execution.duration_ms ? formatDuration(execution.duration_ms) : '—'}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                Status
              </div>
              <div className="mt-1">{getStatusBadge(execution.status)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Execution Logs */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Live Execution Log</h2>
              <p className="mt-1 text-sm text-gray-500">
                {logs.length} tool calls • Total: ${totalCost.toFixed(3)}
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  No logs yet. Execution starting...
                </div>
              ) : (
                logs.map((log, index) => <LogEntry key={index} log={log} />)
              )}
            </div>
          </div>

          {/* Storage */}
          {storage && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Storage</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {storage.blobs.length} files • {(storage.total_size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="px-6 py-4">
                <StorageView storage={storage} wippli_id={execution.wippli_id} />
              </div>
            </div>
          )}

          {/* Configuration */}
          {config && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Configuration</h2>
              </div>
              <div className="px-6 py-4">
                <ConfigDisplay config={config} />
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Cost Breakdown</h2>
            </div>
            <div className="px-6 py-4">
              <CostBreakdown logs={logs} storage={storage} />
            </div>
          </div>

          {/* Wippli Integration */}
          {wippliIntegration && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Wippli Integration</h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Wippli Task</span>
                  <a
                    href={wippliIntegration.task_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View Task
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                {wippliIntegration.proof_url && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">Proof URL</span>
                    <a
                      href={wippliIntegration.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View Proof
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Comment Posted</span>
                  <span className="text-sm text-gray-600">
                    {wippliIntegration.comment_posted ? '✅ Yes' : '⏳ Not yet'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">Finals Uploaded</span>
                  <span className="text-sm text-gray-600">
                    {wippliIntegration.finals_uploaded ? '✅ Yes' : '⏳ Not yet'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-sm text-gray-500">
            © 2025 Wippli PTY LTD. PowerNode MCP SuperNode. From Australia with ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
