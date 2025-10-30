import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock, DollarSign } from 'lucide-react';

interface LogEntryProps {
  log: {
    timestamp: string;
    tool: string;
    input: any;
    output: any;
    duration_ms: number;
    status: 'success' | 'failed';
    cost?: number;
  };
}

export default function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function formatToolName(tool: string) {
    return tool.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-4">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-1">
          {log.status === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 font-mono">{formatTime(log.timestamp)}</span>
              <h3 className="text-sm font-semibold text-gray-900">{formatToolName(log.tool)}</h3>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                {log.duration_ms < 1000
                  ? `${log.duration_ms}ms`
                  : `${(log.duration_ms / 1000).toFixed(1)}s`}
              </div>

              {log.cost !== undefined && log.cost > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <DollarSign className="w-3 h-3" />
                  {log.cost.toFixed(3)}
                </div>
              )}

              <button
                onClick={() => setExpanded(!expanded)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="mt-1 text-sm text-gray-600">
            {renderQuickSummary(log)}
          </div>

          {/* Expanded Details */}
          {expanded && (
            <div className="mt-4 space-y-3">
              {/* Input */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Input
                </h4>
                <pre className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
                  {JSON.stringify(log.input, null, 2)}
                </pre>
              </div>

              {/* Output */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Output
                </h4>
                <pre className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
                  {JSON.stringify(log.output, null, 2)}
                </pre>
              </div>

              {/* Special rendering for specific tools */}
              {renderSpecialContent(log)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function renderQuickSummary(log: any) {
  const { tool, output } = log;

  switch (tool) {
    case 'download_wippli_file':
      return `Downloaded to ${output.blob_path} (${output.size_mb} MB)`;

    case 'query_vector_database':
      return `Retrieved ${output.results?.length || 0} results from vector database`;

    case 'populate_document_template':
      return `Answered ${output.questions_answered} questions → ${output.output_path}`;

    case 'convert_to_pdf_and_upload_proof':
      return `Converted to PDF and uploaded to Wippli (Proof #${output.wippli_proof_id})`;

    case 'get_wippli_comments':
      return `Retrieved ${output.comments?.length || 0} comments`;

    case 'apply_feedback_and_regenerate':
      return `Generated version ${output.version} with feedback applied`;

    case 'move_to_finals':
      return `Moved ${output.finals?.length || 0} files to Finals`;

    case 'post_wippli_comment':
      return `Posted comment #${output.comment_id}`;

    case 'get_wippli_task':
      return `Task: ${output.task_name || 'Unknown'}`;

    case 'list_task_files':
      return `Found ${output.files?.length || 0} files`;

    default:
      return 'Completed successfully';
  }
}

function renderSpecialContent(log: any) {
  const { tool, output } = log;

  // RAG Results for query_vector_database
  if (tool === 'query_vector_database' && output.results) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          Vector DB Results ({output.results.length} chunks)
        </h4>
        <div className="space-y-2">
          {output.results.slice(0, 5).map((result: any, index: number) => (
            <div key={index} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-900">
                  Score: {(result.score * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-blue-700">{result.source}</span>
              </div>
              <p className="text-sm text-gray-800 line-clamp-3">{result.content}</p>
            </div>
          ))}
          {output.results.length > 5 && (
            <p className="text-xs text-gray-500 italic">
              + {output.results.length - 5} more results
            </p>
          )}
        </div>
      </div>
    );
  }

  // AI Token Usage for populate_document_template
  if (tool === 'populate_document_template' && output.tokens) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
          AI Token Usage
        </h4>
        <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-purple-700">Model</div>
              <div className="font-semibold text-purple-900">{output.ai_model || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-purple-700">Input Tokens</div>
              <div className="font-semibold text-purple-900">
                {output.tokens?.input?.toLocaleString() || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-purple-700">Output Tokens</div>
              <div className="font-semibold text-purple-900">
                {output.tokens?.output?.toLocaleString() || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
