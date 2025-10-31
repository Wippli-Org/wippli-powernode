import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, Filter, Download, Trash2, Pause, Play, Server, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  executionId: string;
  wippliId: number;
  creatorId: string;
  tool: string;
  level: 'info' | 'error' | 'warning' | 'success';
  message: string;
  data?: any;
}

interface MCPStatus {
  success: boolean;
  hasConnection: boolean;
  serverCount: number;
  toolCount: number;
  servers: any[];
  tools: any[];
  error?: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [mcpLoading, setMcpLoading] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setLastFetchTime(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch MCP status
  const fetchMcpStatus = async () => {
    try {
      const response = await fetch('/api/debug/mcp-status');
      if (response.ok) {
        const data = await response.json();
        setMcpStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch MCP status:', error);
    } finally {
      setMcpLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLogs();
    fetchMcpStatus();
  }, []);

  // Auto-refresh every 2 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.executionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.tool.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.creatorId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Level filter
    if (levelFilter !== 'all') {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, levelFilter]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoRefresh && filteredLogs.length > 0) {
      scrollToBottom();
    }
  }, [filteredLogs, autoRefresh]);

  const clearLogs = () => {
    if (confirm('Clear all logs from view? (This will not delete logs from storage)')) {
      setLogs([]);
    }
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `powernode-logs-${new Date().toISOString()}.json`;
    link.click();
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return colors[level as keyof typeof colors] || colors.info;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Live Logs</h1>
          <p className="text-gray-600">Real-time PowerNode execution logs</p>
        </div>

        {/* MCP Connection Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">MCP Connection Status</h2>
            </div>
            <button
              onClick={fetchMcpStatus}
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {mcpLoading ? (
            <div className="flex items-center justify-center py-4 text-gray-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading MCP status...
            </div>
          ) : mcpStatus?.error ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">Connection Error</p>
                <p className="text-xs text-red-700">{mcpStatus.error}</p>
              </div>
            </div>
          ) : mcpStatus ? (
            <div className="space-y-3">
              {/* Connection Status */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  {mcpStatus.hasConnection ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <div>
                    <p className="text-xs text-gray-600">Database</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {mcpStatus.hasConnection ? 'Connected' : 'Disconnected'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <Server className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-xs text-gray-600">MCP Servers</p>
                    <p className="text-sm font-semibold text-gray-900">{mcpStatus.serverCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-600">Available Tools</p>
                    <p className="text-sm font-semibold text-gray-900">{mcpStatus.toolCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  {mcpStatus.serverCount > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="text-xs text-gray-600">Chat Integration</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {mcpStatus.serverCount > 0 ? 'Ready' : 'No Servers'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Details */}
              {mcpStatus.servers && mcpStatus.servers.length > 0 && (
                <details className="mt-2">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900 font-medium">
                    View Server Details ({mcpStatus.servers.length} servers)
                  </summary>
                  <div className="mt-3 space-y-2">
                    {mcpStatus.servers.map((server: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{server.name}</p>
                            <p className="text-xs text-gray-600 mt-1">{server.url}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs">
                              <span className="text-gray-600">
                                Tools: <span className="font-semibold text-gray-900">{server.tools.length}</span>
                              </span>
                              <span className="text-gray-600">
                                API Key: {server.hasApiKey ? (
                                  <span className="text-green-600 font-semibold">Configured</span>
                                ) : (
                                  <span className="text-gray-400">Not set</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* No Servers Warning */}
              {mcpStatus.serverCount === 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-yellow-900">No MCP Servers Configured</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        The chat page won't have access to MCP tools until you add MCP servers.
                        <a href="/mcp-tools" className="ml-1 underline hover:text-yellow-900">
                          Add MCP servers here
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                autoRefresh
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {autoRefresh ? (
                <>
                  <Play className="w-4 h-4" />
                  Live
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Paused
                </>
              )}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={fetchLogs}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>

            {/* Export */}
            <button
              onClick={exportLogs}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            {/* Clear */}
            <button
              onClick={clearLogs}
              className="px-4 py-2 border border-red-300 text-red-700 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>

          {/* Status */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="text-gray-600">
              Showing {filteredLogs.length} of {logs.length} logs
            </div>
            {lastFetchTime && (
              <div className="text-gray-500">
                Last updated: {lastFetchTime.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Logs Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="h-[calc(100vh-400px)] overflow-y-auto p-4 space-y-2 font-mono text-sm">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No logs to display
              </div>
            ) : (
              <>
                {filteredLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`border rounded p-3 ${getLevelColor(log.level)}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Timestamp */}
                      <div className="text-xs text-gray-500 whitespace-nowrap mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>

                      {/* Level Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${getLevelBadge(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-700">{log.tool}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-600">
                            Exec: {log.executionId.substring(0, 12)}...
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-600">
                            Wippli: {log.wippliId}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-600">{log.creatorId}</span>
                        </div>
                        <div className="text-gray-800 break-words">{log.message}</div>
                        {log.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                              View data
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
