import { useState, useEffect } from 'react';
import {
  Server, CheckCircle, AlertCircle, Play, FileJson, Download, Plus,
  Settings, Zap, Clock, Activity, X, Edit2, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

interface MCPTool {
  name: string;
  description: string;
  lastUsed?: string;
  schema?: any;
  inputSchema?: any;  // Standard MCP format
}

interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  apiKey?: string;
  n8nServerUrl?: string;  // For n8n MCP servers - the actual n8n instance URL
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  tools: MCPTool[];
}

// Sample test MCP server
const INITIAL_MCP_SERVERS: MCPServer[] = [
  {
    id: 'test-mcp',
    name: 'Test MCP Server',
    description: 'Example MCP server for testing tool execution',
    url: 'http://localhost:3000/mcp/test',
    status: 'healthy',
    latency: 12,
    uptime: 100,
    tools: [
      {
        name: 'echo',
        description: 'Echo back the provided message',
        lastUsed: 'Never',
        schema: {
          message: { type: 'string', required: true, description: 'Message to echo' }
        }
      },
      {
        name: 'add',
        description: 'Add two numbers together',
        lastUsed: 'Never',
        schema: {
          a: { type: 'number', required: true, description: 'First number' },
          b: { type: 'number', required: true, description: 'Second number' }
        }
      }
    ]
  }
];

export default function MCPToolsPage() {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [toolArgs, setToolArgs] = useState<string>('{\n  \n}');
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [showEditServer, setShowEditServer] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTool, setShowAddTool] = useState(false);
  const [addingToolToServer, setAddingToolToServer] = useState<MCPServer | null>(null);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  // Add/Edit Server Form State
  const [newServerName, setNewServerName] = useState('');
  const [newServerDescription, setNewServerDescription] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerApiKey, setNewServerApiKey] = useState('');
  const [newN8nServerUrl, setNewN8nServerUrl] = useState('');
  const [newServerTools, setNewServerTools] = useState('[]');

  // Add Tool Form State
  const [newToolName, setNewToolName] = useState('');
  const [newToolDescription, setNewToolDescription] = useState('');
  const [newToolSchema, setNewToolSchema] = useState('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');

  // Fetch servers on page load
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const response = await fetch('/api/mcp/servers');
        if (response.ok) {
          const data = await response.json();
          setMcpServers(data.servers || []);
          if (data.servers && data.servers.length > 0) {
            setSelectedServer(data.servers[0]);
          }
        } else {
          // If no servers found, use initial test server
          setMcpServers(INITIAL_MCP_SERVERS);
          setSelectedServer(INITIAL_MCP_SERVERS[0]);
        }
      } catch (error) {
        console.error('Error fetching servers:', error);
        // Fallback to test server
        setMcpServers(INITIAL_MCP_SERVERS);
        setSelectedServer(INITIAL_MCP_SERVERS[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  // Listen for localStorage events (cross-page sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mcp-servers-updated') {
        // Refetch servers when they change
        fetch('/api/mcp/servers')
          .then(res => res.json())
          .then(data => {
            if (data.servers) {
              setMcpServers(data.servers);
            }
          })
          .catch(err => console.error('Failed to reload MCP servers:', err));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Helper to trigger sync across pages
  const triggerSync = () => {
    localStorage.setItem('mcp-servers-updated', Date.now().toString());
  };

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
    const schema = tool.inputSchema?.properties || tool.schema || {};
    if (schema && typeof schema === 'object') {
      Object.entries(schema).forEach(([key, value]: [string, any]) => {
        if (value.type === 'string') {
          example[key] = value.description?.includes('path') ? '/path/to/file' : 'example value';
        } else if (value.type === 'array') {
          example[key] = [];
        } else if (value.type === 'number') {
          example[key] = 10;
        }
      });
    }
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

      // Call backend API to execute tool
      const response = await fetch('/api/mcp/execute-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId: selectedServer.id,
          toolName: selectedTool.name,
          arguments: args,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult(JSON.stringify(result, null, 2));

        // Update server latency in state
        if (result.latency !== undefined) {
          setMcpServers(prevServers =>
            prevServers.map(s =>
              s.id === selectedServer.id
                ? { ...s, latency: result.latency }
                : s
            )
          );
        }
      } else {
        setTestResult(JSON.stringify({
          success: false,
          error: result.error || 'Failed to execute tool',
        }, null, 2));
      }
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

  const handleAddServer = async () => {
    if (!newServerName || !newServerUrl) {
      alert('Please fill in server name and URL');
      return;
    }

    try {
      const serverId = newServerName.toLowerCase().replace(/\s+/g, '-');

      // Call backend API to add server
      const response = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: serverId,
          name: newServerName,
          description: newServerDescription || 'Custom MCP Server',
          url: newServerUrl,
          apiKey: newServerApiKey || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Add server to local state
        const newServer: MCPServer = data.server || {
          id: serverId,
          name: newServerName,
          description: newServerDescription || 'Custom MCP Server',
          url: newServerUrl,
          apiKey: newServerApiKey || undefined,
          status: 'healthy',
          latency: 0,
          uptime: 100,
          tools: [],
        };

        setMcpServers([...mcpServers, newServer]);
        setSelectedServer(newServer);
        setShowAddServer(false);

        // Trigger sync to other pages (workflows, chat)
        triggerSync();

        // Reset form
        setNewServerName('');
        setNewServerDescription('');
        setNewServerUrl('');
        setNewServerApiKey('');
      } else {
        const error = await response.json();
        alert(`Failed to add server: ${error.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error adding server:', error);
      alert(`Error adding server: ${error.message}`);
    }
  };

  const handleCancelAddServer = () => {
    setShowAddServer(false);

    // Reset form
    setNewServerName('');
    setNewServerDescription('');
    setNewServerUrl('');
    setNewServerApiKey('');
  };

  const handleEditServer = (server: MCPServer, e: React.MouseEvent) => {
    e.stopPropagation();

    // Pre-fill form with server data
    setEditingServer(server);
    setNewServerName(server.name);
    setNewServerDescription(server.description);
    setNewServerUrl(server.url);
    setNewServerApiKey(server.apiKey || '');
    setNewN8nServerUrl(server.n8nServerUrl || '');
    setNewServerTools(JSON.stringify(server.tools || [], null, 2));
    setShowEditServer(true);
  };

  const handleSaveEditServer = async () => {
    if (!editingServer || !newServerName || !newServerUrl) {
      alert('Please fill in server name and URL');
      return;
    }

    // Parse and validate tools JSON
    let parsedTools;
    try {
      parsedTools = JSON.parse(newServerTools);
      if (!Array.isArray(parsedTools)) {
        alert('Tools must be a JSON array');
        return;
      }
    } catch (error) {
      alert('Invalid JSON in Tools field');
      return;
    }

    try {
      const response = await fetch('/api/mcp/servers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingServer.id,
          name: newServerName,
          description: newServerDescription,
          url: newServerUrl,
          apiKey: newServerApiKey || undefined,
          n8nServerUrl: newN8nServerUrl || undefined,
          tools: parsedTools,
        }),
      });

      if (response.ok) {
        // Update local state
        setMcpServers(prevServers =>
          prevServers.map(s =>
            s.id === editingServer.id
              ? {
                  ...s,
                  name: newServerName,
                  description: newServerDescription,
                  url: newServerUrl,
                  apiKey: newServerApiKey || undefined,
                  n8nServerUrl: newN8nServerUrl || undefined,
                  tools: parsedTools,
                }
              : s
          )
        );

        // Update selected server if it was the one being edited
        if (selectedServer?.id === editingServer.id) {
          setSelectedServer({
            ...selectedServer,
            name: newServerName,
            description: newServerDescription,
            url: newServerUrl,
            apiKey: newServerApiKey || undefined,
            n8nServerUrl: newN8nServerUrl || undefined,
            tools: parsedTools,
          });
        }

        setShowEditServer(false);
        setEditingServer(null);

        // Trigger sync to other pages
        triggerSync();

        // Reset form
        setNewServerName('');
        setNewServerDescription('');
        setNewServerUrl('');
        setNewServerApiKey('');
        setNewServerTools('[]');
      } else {
        const error = await response.json();
        alert(`Failed to update server: ${error.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating server:', error);
      alert(`Error updating server: ${error.message}`);
    }
  };

  const handleCancelEditServer = () => {
    setShowEditServer(false);
    setEditingServer(null);

    // Reset form
    setNewServerName('');
    setNewServerDescription('');
    setNewServerUrl('');
    setNewServerApiKey('');
  };

  const handleDeleteServer = async (server: MCPServer, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Are you sure you want to delete "${server.name}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/mcp/servers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: server.id,
        }),
      });

      if (response.ok) {
        // Remove from local state
        setMcpServers(prevServers => prevServers.filter(s => s.id !== server.id));

        // Clear selection if deleted server was selected
        if (selectedServer?.id === server.id) {
          setSelectedServer(mcpServers.length > 1 ? mcpServers[0] : null);
        }

        // Trigger sync to other pages
        triggerSync();
      } else {
        const error = await response.json();
        alert(`Failed to delete server: ${error.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error deleting server:', error);
      alert(`Error deleting server: ${error.message}`);
    }
  };

  const handleAddTool = async () => {
    if (!addingToolToServer || !newToolName || !newToolDescription) {
      alert('Please fill in tool name and description');
      return;
    }

    // Parse and validate schema JSON
    let parsedSchema;
    try {
      parsedSchema = JSON.parse(newToolSchema);
    } catch (error) {
      alert('Invalid JSON in Input Schema field');
      return;
    }

    try {
      const newTool: MCPTool = {
        name: newToolName,
        description: newToolDescription,
        inputSchema: parsedSchema,
        lastUsed: 'Never',
      };

      // Update tools array for the server
      const updatedTools = [...(addingToolToServer.tools || []), newTool];

      // Call API to update server with new tool
      const response = await fetch('/api/mcp/servers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: addingToolToServer.id,
          name: addingToolToServer.name,
          description: addingToolToServer.description,
          url: addingToolToServer.url,
          apiKey: addingToolToServer.apiKey || undefined,
          tools: updatedTools,
        }),
      });

      if (response.ok) {
        // Update local state
        setMcpServers(prevServers =>
          prevServers.map(s =>
            s.id === addingToolToServer.id
              ? { ...s, tools: updatedTools }
              : s
          )
        );

        // Update selected server if it was the one being modified
        if (selectedServer?.id === addingToolToServer.id) {
          setSelectedServer({
            ...selectedServer,
            tools: updatedTools,
          });
        }

        setShowAddTool(false);
        setAddingToolToServer(null);

        // Trigger sync to other pages
        triggerSync();

        // Reset form
        setNewToolName('');
        setNewToolDescription('');
        setNewToolSchema('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
      } else {
        const error = await response.json();
        alert(`Failed to add tool: ${error.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error adding tool:', error);
      alert(`Error adding tool: ${error.message}`);
    }
  };

  const handleCancelAddTool = () => {
    setShowAddTool(false);
    setAddingToolToServer(null);

    // Reset form
    setNewToolName('');
    setNewToolDescription('');
    setNewToolSchema('{\n  "type": "object",\n  "properties": {},\n  "required": []\n}');
  };

  const toggleServerExpanded = (serverId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedServers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverId)) {
        newSet.delete(serverId);
      } else {
        newSet.add(serverId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="h-screen bg-grey-400 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-light">Loading MCP servers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-grey-400 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-grey-500 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-header">MCP Tools Management</h1>
            <p className="text-sm text-light mt-1">Manage and test Model Context Protocol servers and tools</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportConfig}
              className="flex items-center gap-2 px-4 py-2 bg-sidebar border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors text-sm"
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
          <div className="col-span-5 h-full bg-sidebar border-r border-grey-500 overflow-y-auto p-6">
            <div className="space-y-4">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  onClick={() => setSelectedServer(server)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedServer?.id === server.id
                      ? 'border-primary bg-primary/5'
                      : 'border-grey-500 hover:border-gray-300'
                  }`}
                >
                  {/* Server Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-header">{server.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Edit and Delete buttons */}
                      <button
                        onClick={(e) => handleEditServer(server, e)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Edit server"
                      >
                        <Edit2 className="w-4 h-4 text-light hover:text-primary" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteServer(server, e)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Delete server"
                      >
                        <Trash2 className="w-4 h-4 text-light hover:text-red-600" />
                      </button>

                      {/* Status indicator */}
                      <div className="flex items-center gap-1 ml-2">
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
                  </div>

                  <p className="text-sm text-light mb-3">{server.description}</p>

                  {/* Server Stats */}
                  <div className="flex items-center gap-4 text-xs text-light">
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
                  <div className="mt-4 pt-4 border-t border-grey-500">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        onClick={(e) => toggleServerExpanded(server.id, e)}
                        className="flex items-center gap-2 hover:bg-grey-400 rounded px-2 py-1 transition-colors flex-1 text-left"
                      >
                        <h4 className="text-xs font-semibold text-neutral-700">
                          Available Tools ({server.tools?.length || 0})
                        </h4>
                        {expandedServers.has(server.id) ? (
                          <ChevronUp className="w-3.5 h-3.5 text-light" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-light" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingToolToServer(server);
                          setShowAddTool(true);
                        }}
                        className="p-1 hover:bg-primary/10 rounded transition-colors"
                        title="Add new tool"
                      >
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </button>
                    </div>
                    {expandedServers.has(server.id) && (
                      <div className="space-y-2">
                        {(server.tools || []).map((tool) => (
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
                              : 'border-gray-100 hover:border-grey-500 bg-grey-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-header truncate">{tool.name}</p>
                              <p className="text-xs text-light">{tool.description}</p>
                            </div>
                            <span className="text-xs text-gray-400 ml-2">{tool.lastUsed || 'Never'}</span>
                          </div>
                        </div>
                      ))}
                      </div>
                    )}
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
                <h2 className="text-lg font-semibold text-header">Tool Tester</h2>
              </div>

              {selectedTool ? (
                <div className="space-y-4">
                  {/* Tool Selector */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                      {(() => {
                        const schema = selectedTool.inputSchema?.properties || selectedTool.schema || {};
                        if (schema && typeof schema === 'object') {
                          return Object.entries(schema).map(([key, value]: [string, any]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-blue-900">{key}</span>
                              <span className="text-blue-700"> ({value.type})</span>
                              {value.required && (
                                <span className="ml-1 text-xs text-red-600">*required</span>
                              )}
                              <p className="text-xs text-blue-600 mt-1">{value.description}</p>
                            </div>
                          ));
                        }
                        return <p className="text-sm text-light">No schema information available</p>;
                      })()}
                    </div>
                  </div>

                  {/* Testing Tips */}
                  <div className="mt-4 p-4 bg-grey-400 border border-grey-500 rounded-lg">
                    <h3 className="text-sm font-semibold text-header mb-2">Testing Tips</h3>
                    <ul className="text-sm text-light space-y-1 list-disc list-inside">
                      <li>Ensure JSON is valid before executing</li>
                      <li>Check schema for required parameters</li>
                      <li>File paths must be accessible</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-light">
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

      {/* Add MCP Server Modal */}
      {showAddServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-header">Add MCP Server</h3>
              <button
                onClick={() => setShowAddServer(false)}
                className="text-gray-400 hover:text-light"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Server Name *
                </label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g., n8n Workflow MCP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newServerDescription}
                  onChange={(e) => setNewServerDescription(e.target.value)}
                  placeholder="e.g., Execute n8n workflows via MCP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Server URL *
                </label>
                <input
                  type="text"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="e.g., https://n8n.example.com/mcp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  value={newServerApiKey}
                  onChange={(e) => setNewServerApiKey(e.target.value)}
                  placeholder="Bearer token or API key for authentication"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-light mt-1">Leave blank if server doesn't require authentication</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">n8n MCP Example</h4>
                <p className="text-xs text-blue-700 mb-2">To add n8n workflow execution:</p>
                <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
                  <li>Name: "n8n Workflow MCP"</li>
                  <li>URL: Your n8n instance MCP endpoint</li>
                  <li>API Key: Your n8n API key (if required)</li>
                  <li>Tools will be auto-discovered from server</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddServer(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddServer}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add Server
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit MCP Server Modal */}
      {showEditServer && editingServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-header">Edit MCP Server</h3>
              <button
                onClick={handleCancelEditServer}
                className="text-gray-400 hover:text-light"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Server Name *
                </label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="e.g., n8n Workflow MCP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newServerDescription}
                  onChange={(e) => setNewServerDescription(e.target.value)}
                  placeholder="e.g., Execute n8n workflows via MCP"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Server URL *
                </label>
                <input
                  type="text"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="e.g., https://n8n.example.com/mcp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  API Key (Optional)
                </label>
                <input
                  type="password"
                  value={newServerApiKey}
                  onChange={(e) => setNewServerApiKey(e.target.value)}
                  placeholder="Bearer token or API key for authentication"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-light mt-1">Leave blank to keep existing API key</p>
              </div>

              {newServerUrl.includes('/mcp-server/n8n') && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    n8n Server URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={newN8nServerUrl}
                    onChange={(e) => setNewN8nServerUrl(e.target.value)}
                    placeholder="e.g., https://n8n.brannium.com/api/v1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-light mt-1">
                    The actual n8n instance to connect to (overrides instance-level config)
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Tools (JSON Array)
                </label>
                <textarea
                  value={newServerTools}
                  onChange={(e) => setNewServerTools(e.target.value)}
                  placeholder={`[\n  {\n    "name": "tool_name",\n    "description": "What this tool does",\n    "inputSchema": {\n      "type": "object",\n      "properties": {}\n    }\n  }\n]`}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-light mt-1">JSON array of tools available on this MCP server</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelEditServer}
                  className="flex-1 px-4 py-2 border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditServer}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Tool Modal */}
      {showAddTool && addingToolToServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-header">
                Add New Tool to {addingToolToServer.name}
              </h3>
              <button
                onClick={handleCancelAddTool}
                className="text-gray-400 hover:text-light"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Tool Name *
                </label>
                <input
                  type="text"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  placeholder="e.g., get_node_code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-light mt-1">Unique identifier for this tool (use snake_case)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description *
                </label>
                <textarea
                  value={newToolDescription}
                  onChange={(e) => setNewToolDescription(e.target.value)}
                  placeholder="e.g., Extract JavaScript code from a specific Code node in an n8n workflow"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-light mt-1">Clear description of what this tool does</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Input Schema (JSON) *
                </label>
                <textarea
                  value={newToolSchema}
                  onChange={(e) => setNewToolSchema(e.target.value)}
                  placeholder={`{\n  "type": "object",\n  "properties": {\n    "paramName": {\n      "type": "string",\n      "description": "Parameter description"\n    }\n  },\n  "required": ["paramName"]\n}`}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-light mt-1">JSON schema defining the tool's input parameters</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Example Tool Schema</h4>
                <pre className="text-xs text-blue-700 overflow-x-auto">{`{
  "type": "object",
  "properties": {
    "workflowId": {
      "type": "string",
      "description": "The workflow ID"
    },
    "nodeName": {
      "type": "string",
      "description": "Name of the Code node"
    }
  },
  "required": ["workflowId", "nodeName"]
}`}</pre>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancelAddTool}
                  className="flex-1 px-4 py-2 border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTool}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add Tool
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
