import { DollarSign, Brain, Database, HardDrive } from 'lucide-react';

interface CostBreakdownProps {
  logs: Array<{
    tool: string;
    cost?: number;
    output?: any;
  }>;
  storage: {
    total_size: number;
  } | null;
}

export default function CostBreakdown({ logs, storage }: CostBreakdownProps) {
  // Calculate AI costs
  const aiCosts = logs
    .filter((log) => log.tool === 'populate_document_template' || log.tool === 'query_vector_database')
    .reduce((sum, log) => sum + (log.cost || 0), 0);

  // Calculate storage costs (estimated)
  const storageCostPerGB = 0.018; // Hot tier
  const storageCost = storage
    ? (storage.total_size / 1024 / 1024 / 1024) * storageCostPerGB
    : 0;

  // Vector DB query costs (estimated)
  const vectorDbQueries = logs.filter((log) => log.tool === 'query_vector_database').length;
  const vectorDbCost = vectorDbQueries * 0.001; // Rough estimate

  // Other function execution costs
  const functionExecutions = logs.length;
  const executionCost = functionExecutions * 0.0000002; // Azure Functions pricing

  const totalCost = aiCosts + storageCost + vectorDbCost + executionCost;

  // AI token breakdown
  const aiTokens = logs
    .filter((log) => log.tool === 'populate_document_template')
    .reduce(
      (acc, log) => {
        if (log.output?.tokens) {
          acc.input += log.output.tokens.input || 0;
          acc.output += log.output.tokens.output || 0;
        }
        return acc;
      },
      { input: 0, output: 0 }
    );

  return (
    <div className="space-y-6">
      {/* Total Cost */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold mb-1">
              <DollarSign className="w-5 h-5" />
              Total Estimated Cost
            </div>
            <p className="text-xs text-gray-600">This execution</p>
          </div>
          <div className="text-4xl font-bold text-primary">${totalCost.toFixed(3)}</div>
        </div>
      </div>

      {/* Cost Breakdown Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* AI Costs */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">AI Processing</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-600">
                  {aiTokens.input > 0 ? (
                    <>
                      {aiTokens.input.toLocaleString()} input tokens, {aiTokens.output.toLocaleString()} output
                      tokens
                    </>
                  ) : (
                    'No AI processing'
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                ${aiCosts.toFixed(3)}
              </td>
            </tr>

            {/* Vector DB */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">Vector Database</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-600">{vectorDbQueries} queries</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                ${vectorDbCost.toFixed(3)}
              </td>
            </tr>

            {/* Storage */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">Blob Storage</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-600">
                  {storage ? `${(storage.total_size / 1024 / 1024).toFixed(2)} MB (Hot tier)` : 'No storage'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                ${storageCost.toFixed(4)}
              </td>
            </tr>

            {/* Function Executions */}
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">⚡ Function Executions</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-600">{functionExecutions} executions</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                ${executionCost.toFixed(6)}
              </td>
            </tr>

            {/* Total */}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
              <td className="px-6 py-4"></td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-lg text-primary">
                ${totalCost.toFixed(3)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cost Optimization Tips */}
      {totalCost > 0.1 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">💡 Cost Optimization Tips</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            {aiCosts > 0.05 && (
              <li>Consider using Claude Haiku for simple operations (12x cheaper than Sonnet)</li>
            )}
            {vectorDbQueries > 5 && <li>Enable RAG result caching to reduce redundant vector DB queries</li>}
            {storage && storage.total_size > 10 * 1024 * 1024 && (
              <li>Move old task files to Archive tier for 94% storage cost savings</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
