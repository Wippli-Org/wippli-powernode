import { Activity, FileText, Zap, Settings } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">PowerNode</h1>
          <p className="text-xl text-gray-600 mb-2">MCP SuperNode Execution Monitor</p>
          <p className="text-sm text-gray-500">Claude-Centric AI Orchestration Platform</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-primary">
            <Activity className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-Time Monitoring</h3>
            <p className="text-sm text-gray-600">
              Watch your MCP tool executions in real-time with detailed logs and metrics.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-primary">
            <FileText className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Per-Wippli Tracking</h3>
            <p className="text-sm text-gray-600">
              Every execution gets a unique shareable URL for easy debugging from n8n.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 border-t-4 border-primary">
            <Zap className="w-12 h-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cost Analytics</h3>
            <p className="text-sm text-gray-600">
              Track AI token usage, storage costs, and get optimization recommendations.
            </p>
          </div>
        </div>

        {/* Configuration Link */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Configure PowerNode</h2>
          <p className="text-gray-600 mb-6">
            Set up AI providers, storage, and custom prompts for your MCP tools
          </p>

          <Link
            href="/config"
            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-white rounded-lg font-semibold hover:bg-secondary/90 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Open Configuration
          </Link>
        </div>

        {/* Demo Link */}
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Try the Demo</h2>
          <p className="text-gray-600 mb-6">
            View a sample execution monitoring page with mock data
          </p>

          <Link
            href="/monitor/pn_exec_demo_7f8a9b2c1d3e4f5a"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            <Activity className="w-5 h-5" />
            View Demo Execution
          </Link>

          <div className="mt-8 text-left bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">How it works:</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>PowerNode executes MCP tools for Wippli tasks</li>
              <li>Each execution gets a unique monitoring token</li>
              <li>Access <code className="bg-white px-2 py-1 rounded text-xs">https://powernode.wippli.ai/{'pn_exec_{token}'}</code></li>
              <li>View real-time logs, storage, configuration, and costs</li>
              <li>Share the URL from n8n executions for easy debugging</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>© 2025 Wippli PTY LTD. From Australia with ❤️</p>
          <p className="mt-2">
            <a
              href="https://github.com/Wippli-Org/wippli-powernode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            {' · '}
            <a href="#" className="text-primary hover:underline">
              Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
