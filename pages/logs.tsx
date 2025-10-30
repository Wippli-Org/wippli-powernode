import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, Filter, Download, Trash2, Pause, Play } from 'lucide-react';

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

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
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

  // Initial fetch
  useEffect(() => {
    fetchLogs();
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
