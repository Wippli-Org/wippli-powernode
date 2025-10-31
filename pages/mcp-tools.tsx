import { useState, useEffect } from 'react';
import {
  Server, CheckCircle, AlertCircle, Play, FileJson, Download, Plus,
  Settings, Zap, Clock, Activity
} from 'lucide-react';

interface MCPTool {
  name: string;
  description: string;
  lastUsed: string;
  schema: any;
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  tools: MCPTool[];
}

// Sample MCP servers based on the PowerDocs design
const INITIAL_MCP_SERVERS: MCPServer[] = [
  {
    id: 'document-ops',
    name: 'Document Operations MCP',
    description: 'Edit Word, Excel, and PDF documents programmatically',
    url: 'https://powerdocs.wippli.ai/mcp/document-ops',
    status: 'healthy',
    latency: 23,
    uptime: 99.9,
    tools: [
      {
        name: 'edit_word_document',
        description: 'Edit Microsoft Word documents with operations',
        lastUsed: '5m ago',
        schema: {
          filepath: { type: 'string', required: true, description: 'Path to Word document' },
          operations: { type: 'array', required: true, description: 'Array of edit operations' }
        }
      },
      {
        name: 'edit_excel_file',
        description: 'Modify Excel spreadsheets, cells, and formulas',
        lastUsed: '12m ago',
        schema: {
          filepath: { type: 'string', required: true, description: 'Path to Excel file' },
          sheet: { type: 'string', required: false, description: 'Sheet name' },
          operations: { type: 'array', required: true, description: 'Array of operations' }
        }
      },
      {
        name: 'convert_word_to_pdf',
        description: 'Convert Word documents to PDF format',
        lastUsed: '1h ago',
        schema: {
          source: { type: 'string', required: true, description: 'Source Word file' },
          destination: { type: 'string', required: true, description: 'Destination PDF path' }
        }
      },
      {
        name: 'create_word_document',
        description: 'Create new Word documents from text',
        lastUsed: '3h ago',
        schema: {
          filepath: { type: 'string', required: true, description: 'Destination file path' },
          content: { type: 'string', required: true, description: 'Document content' }
        }
      },
      {
        name: 'merge_pdfs',
        description: 'Combine multiple PDF files into one',
        lastUsed: 'Yesterday',
        schema: {
          sources: { type: 'array', required: true, description: 'Array of source PDF paths' },
          destination: { type: 'string', required: true, description: 'Output PDF path' }
        }
      }
    ]
  },
  {
    id: 'wippli-context',
    name: 'Wippli Context MCP',
    description: 'Query Wippli tasks, comments, proofs, and company data',
    url: 'https://powerdocs.wippli.ai/mcp/wippli-context',
    status: 'healthy',
    latency: 15,
    uptime: 100,
    tools: [
      {
        name: 'get_wippli_task',
        description: 'Retrieve Wippli task details by ID',
        lastUsed: '2m ago',
        schema: {
          task_id: { type: 'string', required: true, description: 'Wippli task ID' }
        }
      },
      {
        name: 'get_comments',
        description: 'Fetch comments for a Wippli task',
        lastUsed: '10m ago',
        schema: {
          task_id: { type: 'string', required: true, description: 'Task ID' },
          limit: { type: 'number', required: false, description: 'Max comments to return' }
        }
      },
      {
        name: 'get_proofs',
        description: 'Get proof versions for a task',
        lastUsed: '30m ago',
        schema: {
          task_id: { type: 'string', required: true, description: 'Task ID' }
        }
      },
      {
        name: 'query_company_data',
        description: 'Query company information and settings',
        lastUsed: '1h ago',
        schema: {
          query: { type: 'string', required: true, description: 'Query string' }
        }
      }
    ]
  }
];

export default function MCPToolsPage() {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>(INITIAL_MCP_SERVERS);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>('{\n  \n}');
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);

  useEffect(() => {
    if (mcpServers.length > 0) {
      setSelectedServer(mcpServers[0]);
    }
  }, []);

  useEffect(() => {
    if (selectedServer && selectedServer.tools.length > 0 && !selectedTool) {
      setSelectedTool(selectedServer.tools[0]);
      // Set example args for first tool
      const exampleArgs = generateExampleArgs(selectedServer.tools[0]);
      setToolArgs(exampleArgs);
    }
  }, [selectedServer]);

  const generateExampleArgs = (tool: MCPTool): string => {
    const example: any = {};
    Object.entries(tool.schema).forEach(([key, value]: [string, any]) => {
      if (value.type === 'string') {
        example[key] = value.description.includes('path') ? '/path/to/file' : 'example value';
      } else if (value.type === 'array') {
        example[key] = [];
      } else if (value.type === 'number') {
        example[key] = 10;
      }
    });
    return JSON.stringify(example, null, 2);
  };

  const handleToolSelect = (tool: MCPTool) => {
    setSelectedTool(tool);
    setToolArgs(generateExampleArgs(tool));
    setTestResult('');
  };

  const handleExecuteTool = async () => {
    if (!selectedTool || !selectedServer) return;

    setTesting(true);
    setTestResult('');

    try {
      // Validate JSON
      const args = JSON.parse(toolArgs);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockResult = {
        success: true,
        message: `${selectedTool.name} executed successfully`,
        tool: selectedTool.name,
        server: selectedServer.name,
        execution_time: `${selectedServer.latency}ms`,
        data: args
      };

      setTestResult(JSON.stringify(mockResult, null, 2));
    } catch (error: any) {
      setTestResult(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2));
    } finally {
      setTesting(false);
    }
  };

  const exportConfig = () => {
    const config = {
      servers: mcpServers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.url,
        tools: s.tools.map(t => t.name)
      }))
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mcp-config.json';
    a.click();
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MCP Tools Management</h1>
            <p className="text-sm text-gray-600 mt-1">Manage and test Model Context Protocol servers and tools</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Export Config
            </button>
            <button
              onClick={() => setShowAddServer(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add MCP Server
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-0">
          {/* MCP Servers List */}
          <div className="col-span-5 h-full bg-white border-r border-gray-200 overflow-y-auto p-6">
            <div className="space-y-4">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  onClick={() => setSelectedServer(server)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedServer?.id === server.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Server Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-gray-900">{server.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {server.status === 'healthy' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                      <span className={`text-xs font-medium ${
                        server.status === 'healthy' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {server.status === 'healthy' ? 'Healthy' : 'Degraded'}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{server.description}</p>

                  {/* Server Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Latency: {server.latency}ms
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Uptime: {server.uptime}%
                    </div>
                  </div>

                  {/* Tools List */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2">
                      Available Tools ({server.tools.length})
                    </h4>
                    <div className="space-y-2">
                      {server.tools.map((tool) => (
                        <div
                          key={tool.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedServer(server);
                            handleToolSelect(tool);
                          }}
                          className={`p-2 rounded border cursor-pointer transition-colors ${
                            selectedTool?.name === tool.name && selectedServer?.id === server.id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{tool.name}</p>
                              <p className="text-xs text-gray-500">{tool.description}</p>
                            </div>
                            <span className="text-xs text-gray-400 ml-2">{tool.lastUsed}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tool Tester */}
          <div className="col-span-7 h-full bg-white overflow-y-auto p-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Tool Tester</h2>
              </div>

              {selectedTool ? (
                <div className="space-y-4">
                  {/* Tool Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Tool
                    </label>
                    <select
                      value={selectedTool.name}
                      onChange={(e) => {
                        const tool = selectedServer?.tools.find(t => t.name === e.target.value);
                        if (tool) handleToolSelect(tool);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-sm"
                    >
                      {selectedServer?.tools.map((tool) => (
                        <option key={tool.name} value={tool.name}>
                          {tool.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Arguments Editor */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Arguments (JSON)
                    </label>
                    <textarea
                      value={toolArgs}
                      onChange={(e) => setToolArgs(e.target.value)}
                      className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                      placeholder='{\n  "key": "value"\n}'
                    />
                  </div>

                  {/* Execute Button */}
                  <button
                    onClick={handleExecuteTool}
                    disabled={testing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    <Play className="w-4 h-4" />
                    {testing ? 'Executing...' : 'Execute Tool'}
                  </button>

                  {/* Result */}
                  {testResult && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Result
                      </label>
                      <div className="w-full p-4 border border-gray-300 rounded-lg bg-gray-900 text-gray-100 font-mono text-sm overflow-auto max-h-96">
                        <pre>{testResult}</pre>
                      </div>
                    </div>
                  )}

                  {/* Schema Info */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Tool Schema</h3>
                    <div className="space-y-2">
                      {Object.entries(selectedTool.schema).map(([key, value]: [string, any]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium text-blue-900">{key}</span>
                          <span className="text-blue-700"> ({value.type})</span>
                          {value.required && (
                            <span className="ml-1 text-xs text-red-600">*required</span>
                          )}
                          <p className="text-xs text-blue-600 mt-1">{value.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Testing Tips */}
                  <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Testing Tips</h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>Ensure JSON is valid before executing</li>
                      <li>Check schema for required parameters</li>
                      <li>File paths must be accessible</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <FileJson className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-lg font-semibold">No tool selected</p>
                    <p className="text-sm mt-2">Select a tool from the left to test it</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
