import { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  Connection,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Plus, Save, Play, Trash2, Settings, FileText, Edit3, FolderPlus, X, Search,
  GitBranch, Zap, RefreshCw, Clock, Globe, Code, Bug, CheckCircle, Copy,
  FileSearch, Languages, PlayCircle, TestTube, Database, Send, Loader, Clipboard
} from 'lucide-react';
import { getInstanceConfig, getInstanceStorageKey } from '../lib/instance-config';

// Instruction node types with icons and colors
const INSTRUCTION_TYPES = {
  // File Operations
  read: { label: 'Read', icon: FileText, color: '#3b82f6', description: 'Read files/data using MCP' },
  write: { label: 'Write', icon: FolderPlus, color: '#22c55e', description: 'Create new files/data' },
  edit: { label: 'Edit', icon: Edit3, color: '#eab308', description: 'Modify existing content' },
  delete: { label: 'Delete', icon: Trash2, color: '#ef4444', description: 'Remove files/data' },
  search: { label: 'Search', icon: Search, color: '#a855f7', description: 'Find content using MCP' },
  save: { label: 'Save', icon: Database, color: '#14b8a6', description: 'Save data to storage' },

  // AI Operations
  transform: { label: 'Transform', icon: Zap, color: '#f97316', description: 'Use Claude to process data' },
  extract: { label: 'Extract', icon: FileSearch, color: '#6366f1', description: 'Extract specific information' },
  analyse: { label: 'Analyse', icon: FileSearch, color: '#ec4899', description: 'Analyze content with AI' },
  translate: { label: 'Translate', icon: Languages, color: '#06b6d4', description: 'Translate text' },

  // Code Operations
  code: { label: 'Code', icon: Code, color: '#374151', description: 'Generate or execute code' },
  execute: { label: 'Execute', icon: PlayCircle, color: '#8b5cf6', description: 'Execute a command' },
  debug: { label: 'Debug', icon: Bug, color: '#dc2626', description: 'Debug and find issues' },
  fix: { label: 'Fix', icon: CheckCircle, color: '#16a34a', description: 'Fix errors or issues' },
  test: { label: 'Test', icon: TestTube, color: '#2563eb', description: 'Run tests' },

  // Flow Control
  decide: { label: 'Decide', icon: GitBranch, color: '#f59e0b', description: 'Conditional branching' },
  loop: { label: 'Loop', icon: RefreshCw, color: '#84cc16', description: 'Iterate over items' },
  wait: { label: 'Wait', icon: Clock, color: '#64748b', description: 'Delay execution' },

  // Integration
  http: { label: 'HTTP', icon: Globe, color: '#10b981', description: 'Call external APIs' },
  passTo: { label: 'Pass To', icon: Send, color: '#0ea5e9', description: 'Pass data to another service' },
  compare: { label: 'Compare', icon: Copy, color: '#d946ef', description: 'Compare values' },
  correct: { label: 'Correct', icon: CheckCircle, color: '#f43f5e', description: 'Correct data' },
} as const;

type InstructionType = keyof typeof INSTRUCTION_TYPES;

// Default MCP Servers (fallback if API fails)
const DEFAULT_MCP_SERVERS = [
  { id: 'filesystem', name: 'File System MCP', description: 'Local file operations' },
  { id: 'msword', name: 'MS Word MCP', description: 'Microsoft Word documents' },
  { id: 'excel', name: 'MS Excel MCP', description: 'Microsoft Excel spreadsheets' },
  { id: 'powerpoint', name: 'MS PowerPoint MCP', description: 'Microsoft PowerPoint presentations' },
  { id: 'pdf', name: 'PDF MCP', description: 'PDF document operations' },
  { id: 'web', name: 'Web MCP', description: 'Web scraping and browser automation' },
  { id: 'database', name: 'Database MCP', description: 'Database operations' },
  { id: 'api', name: 'API MCP', description: 'REST API interactions' },
  { id: 'email', name: 'Email MCP', description: 'Email operations' },
  { id: 'azure', name: 'Azure MCP', description: 'Azure cloud services' },
];

// Custom Node Component - Square icon with label below
function InstructionNode({ data, mcpServers }: { data: any; mcpServers?: any[] }) {
  const typeInfo = INSTRUCTION_TYPES[data.type as InstructionType];
  const Icon = typeInfo.icon;

  // Get MCP icon if configured
  const serverList = mcpServers || DEFAULT_MCP_SERVERS;
  const mcpServer = data.mcpServer ? serverList.find(s => s.id === data.mcpServer) : null;

  return (
    <div className="relative">
      {/* Input Handle (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: typeInfo.color,
          border: '2px solid white',
          left: '-6px',
        }}
      />

      {/* Square Icon Node */}
      <div
        className="w-16 h-16 rounded shadow-lg border-2 bg-white flex items-center justify-center relative"
        style={{ borderColor: typeInfo.color }}
      >
        <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />

        {/* MCP Badge if configured */}
        {mcpServer && (
          <div
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sidebar border-2 flex items-center justify-center text-xs font-bold shadow"
            style={{ borderColor: '#10b981' }}
            title={mcpServer.name}
          >
            {mcpServer.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Label below node */}
      <div className="absolute top-[68px] left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="text-xs font-semibold text-neutral-700 text-center">
          {data.label || typeInfo.label}
        </div>
      </div>

      {/* Output Handle (right side) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: '12px',
          height: '12px',
          backgroundColor: typeInfo.color,
          border: '2px solid white',
          right: '-6px',
        }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  instruction: InstructionNode,
};

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [mcpServers, setMcpServers] = useState<any[]>(DEFAULT_MCP_SERVERS);

  // Fetch MCP servers from API
  useEffect(() => {
    fetch('/api/mcp/servers')
      .then(res => res.json())
      .then(data => {
        if (data.servers && data.servers.length > 0) {
          setMcpServers(data.servers);
        } else {
          setMcpServers(DEFAULT_MCP_SERVERS);
        }
      })
      .catch((error) => {
        console.error('Error fetching MCP servers:', error);
        setMcpServers(DEFAULT_MCP_SERVERS);
      });
  }, []);

  // Listen for localStorage sync events from MCP Tools page
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mcp-servers-updated') {
        // Refetch MCP servers when they change in MCP Tools page
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

  // Load workflows from localStorage (wippli_id isolated)
  useEffect(() => {
    const storageKey = getInstanceStorageKey('powernode-workflows-v2');
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const workflowsWithDates = parsed.map((w: any) => ({
        ...w,
        createdAt: new Date(w.createdAt),
        updatedAt: new Date(w.updatedAt),
      }));
      setWorkflows(workflowsWithDates);
      if (workflowsWithDates.length > 0) {
        loadWorkflow(workflowsWithDates[0]);
      }
    }
  }, []);

  // Save workflows to localStorage (wippli_id isolated)
  useEffect(() => {
    if (workflows.length > 0) {
      const storageKey = getInstanceStorageKey('powernode-workflows-v2');
      localStorage.setItem(storageKey, JSON.stringify(workflows));
    }
  }, [workflows]);

  // Update active workflow when nodes/edges change
  useEffect(() => {
    if (activeWorkflow) {
      const updated = {
        ...activeWorkflow,
        nodes,
        edges,
        updatedAt: new Date(),
      };
      setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
    }
  }, [nodes, edges]);

  const loadWorkflow = (workflow: Workflow) => {
    setActiveWorkflow(workflow);
    setNodes(workflow.nodes || []);
    setEdges(workflow.edges || []);
  };

  const createNewWorkflow = () => {
    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: `Workflow ${workflows.length + 1}`,
      description: 'New workflow',
      nodes: [],
      edges: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setWorkflows([...workflows, newWorkflow]);
    loadWorkflow(newWorkflow);
  };

  const deleteWorkflow = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      const newWorkflows = workflows.filter(w => w.id !== id);
      setWorkflows(newWorkflows);
      if (activeWorkflow?.id === id) {
        if (newWorkflows.length > 0) {
          loadWorkflow(newWorkflows[0]);
        } else {
          setActiveWorkflow(null);
          setNodes([]);
          setEdges([]);
        }
      }
    }
  };

  const updateWorkflowName = (name: string) => {
    if (activeWorkflow) {
      const updated = { ...activeWorkflow, name, updatedAt: new Date() };
      setActiveWorkflow(updated);
      setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
    }
  };

  const updateWorkflowDescription = (description: string) => {
    if (activeWorkflow) {
      const updated = { ...activeWorkflow, description, updatedAt: new Date() };
      setActiveWorkflow(updated);
      setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
    }
  };

  const addNode = (type: InstructionType) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'instruction',
      position: { x: 250, y: nodes.length * 100 + 50 },
      data: {
        type,
        label: INSTRUCTION_TYPES[type].label,
        config: {},
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setShowTypeSelector(false);
    setSelectedNode(newNode);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowTypeSelector(false);
  }, []);

  const updateNodeConfig = (nodeId: string, config: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, config: { ...node.data.config, ...config } } }
          : node
      )
    );
  };

  const addLogToNode = (nodeId: string, logMessage: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const log = `${timestamp}: ${logMessage}`;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                logs: [...(node.data.logs || []), log],
              },
            }
          : node
      )
    );
  };

  const handleTestNode = async (node: Node) => {
    addLogToNode(node.id, 'Test started - validating configuration...');

    // Basic validation logic
    const errors: string[] = [];
    const typeInfo = INSTRUCTION_TYPES[node.data.type as InstructionType];

    if (!node.data.config || Object.keys(node.data.config).length === 0) {
      addLogToNode(node.id, '⚠ Warning: Node configuration is empty');
    }

    // Type-specific validations
    switch (node.data.type) {
      case 'read':
      case 'write':
      case 'edit':
      case 'delete':
        if (!node.data.config.path && !node.data.config.file) {
          errors.push('File path is required');
        } else {
          addLogToNode(node.id, '✓ File path configured');
        }
        break;
      case 'http':
        if (!node.data.config.url) {
          errors.push('URL is required');
        } else {
          addLogToNode(node.id, '✓ URL configured');
        }
        break;
      case 'search':
        if (!node.data.config.query && !node.data.config.pattern) {
          errors.push('Query or pattern is required');
        } else {
          addLogToNode(node.id, '✓ Search query configured');
        }
        break;
      default:
        addLogToNode(node.id, '✓ Basic validation passed');
    }

    if (errors.length > 0) {
      errors.forEach(err => addLogToNode(node.id, `✗ ${err}`));
      addLogToNode(node.id, 'Test failed - fix errors above');
    } else {
      addLogToNode(node.id, '✓ All tests passed - node ready');
    }
  };

  const handleDebugNode = async (node: Node) => {
    addLogToNode(node.id, 'Debug started...');
    addLogToNode(node.id, 'Sending to AI agent with full context...');

    try {
      // Get supplier_id from instance configuration
      const config = getInstanceConfig();
      const wippli_id = config.supplierId || 'default-wippli';

      // Get or create conversation for workflow debugging
      const conversationId = `workflow-debug-${activeWorkflow?.id || 'unknown'}`;

      // Build context message for the AI
      const connectedNodes = edges
        .filter(e => e.source === node.id || e.target === node.id)
        .map(e => {
          const targetNodeId = e.source === node.id ? e.target : e.source;
          const targetNode = nodes.find(n => n.id === targetNodeId);
          return {
            direction: e.source === node.id ? 'outgoing' : 'incoming',
            type: targetNode?.data.type,
            label: targetNode?.data.label,
          };
        });

      const contextMessage = `Please debug this workflow node and provide a corrected configuration:

**Node Information:**
- Type: ${node.data.type}
- Label: ${node.data.label || 'Untitled'}
- Current Configuration: ${JSON.stringify(node.data.config, null, 2)}
- MCP Server: ${node.data.mcpServer || 'Not selected'}

**Workflow Context:**
- Workflow: ${activeWorkflow?.name || 'Unknown'}
- Connected Nodes: ${connectedNodes.length > 0 ? connectedNodes.map(n => `${n.direction} → ${n.label} (${n.type})`).join(', ') : 'No connections'}

**Previous Logs:**
${node.data.logs && node.data.logs.length > 0 ? node.data.logs.join('\n') : 'No previous logs'}

Please analyze this node and provide:
1. Any issues or problems with the configuration
2. A corrected/optimized configuration as valid JSON
3. Suggestions for the best MCP Server to use

IMPORTANT: If you provide a corrected configuration, format it as a JSON code block like this:
\`\`\`json
{
  "correctedConfig": { ... your corrected config ... },
  "suggestedMcpServer": "msword" (optional)
}
\`\`\`

I will automatically apply this corrected configuration to the node.`;

      // Call the existing chat API to maintain conversation context
      const response = await fetch('/api/chat-with-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wippli_id,
          conversation_id: conversationId,
          message: contextMessage,
        }),
      });

      const result = await response.json();

      if (response.ok && result.message) {
        addLogToNode(node.id, '✓ AI agent response received');

        const aiResponse = result.message;

        // Try to extract corrected configuration from JSON code blocks
        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/;
        const match = aiResponse.match(jsonBlockRegex);

        if (match) {
          try {
            const correctionData = JSON.parse(match[1]);

            // Apply corrected configuration
            if (correctionData.correctedConfig) {
              addLogToNode(node.id, '✓ Applying corrected configuration...');

              setNodes((nds) =>
                nds.map((n) =>
                  n.id === node.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          config: correctionData.correctedConfig,
                          mcpServer: correctionData.suggestedMcpServer || n.data.mcpServer,
                        },
                      }
                    : n
                )
              );

              addLogToNode(node.id, '✓ Configuration updated automatically!');

              if (correctionData.suggestedMcpServer) {
                addLogToNode(
                  node.id,
                  `✓ MCP Server set to: ${correctionData.suggestedMcpServer}`
                );
              }
            }
          } catch (parseError) {
            addLogToNode(node.id, '⚠ Could not parse corrected config');
          }
        }

        // Show first few lines of AI response
        const lines = aiResponse.split('\n').slice(0, 5);
        lines.forEach((line: string) => {
          if (line.trim() && !line.includes('```')) {
            addLogToNode(node.id, line.trim());
          }
        });

        if (aiResponse.split('\n').length > 5) {
          addLogToNode(node.id, '... (check Chat page for full response)');
        }
      } else {
        addLogToNode(node.id, `✗ Debug failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      addLogToNode(node.id, `✗ Error: ${error.message}`);
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = {
        x: event.clientX - 200,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'instruction',
        position,
        data: {
          type,
          label: INSTRUCTION_TYPES[type as InstructionType].label,
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const executeWorkflow = async () => {
    if (!activeWorkflow || nodes.length === 0) return;

    setExecuting(true);
    setExecutionLog([]);

    const log = (message: string) => {
      setExecutionLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    log('Starting workflow execution...');

    try {
      // Simple execution simulation - traverse from nodes without incoming edges
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const visited = new Set<string>();

      const executeNode = async (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodeMap.get(nodeId);
        if (!node) return;

        const typeInfo = INSTRUCTION_TYPES[node.data.type as InstructionType];
        log(`Executing: ${typeInfo.label}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        log(`✓ ${typeInfo.label} completed`);

        // Execute connected nodes
        const outgoingEdges = edges.filter((e) => e.source === nodeId);
        await Promise.all(outgoingEdges.map((e) => executeNode(e.target)));
      };

      // Find start nodes (no incoming edges)
      const startNodes = nodes.filter(
        (node) => !edges.some((edge) => edge.target === node.id)
      );

      if (startNodes.length === 0) {
        log('⚠ No start nodes found. Add nodes without incoming connections.');
      } else {
        await Promise.all(startNodes.map((node) => executeNode(node.id)));
        log('✅ Workflow completed successfully!');
      }
    } catch (error: any) {
      log(`✗ Error: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: InstructionType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const copySelectedNodesToClipboard = async () => {
    const selectedNodes = nodes.filter(node => node.selected);

    if (selectedNodes.length === 0) {
      alert('No nodes selected. Click nodes or drag to select multiple nodes.');
      return;
    }

    // Get edges that connect selected nodes
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    const selectedEdges = edges.filter(
      edge => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    const exportData = {
      nodes: selectedNodes,
      edges: selectedEdges,
      count: selectedNodes.length,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div className="h-screen bg-grey-400 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3 border-b border-grey-500 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-header">Workflow Builder</h1>
              {activeWorkflow && (
                <input
                  type="text"
                  value={activeWorkflow.name}
                  onChange={(e) => updateWorkflowName(e.target.value)}
                  className="text-sm text-light bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySelectedNodesToClipboard}
              disabled={nodes.filter(n => n.selected).length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-sidebar border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              title="Copy selected nodes as JSON"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Clipboard className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={createNewWorkflow}
              className="flex items-center gap-2 px-3 py-2 bg-sidebar border border-gray-300 text-neutral-700 rounded-lg hover:bg-grey-400 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              onClick={executeWorkflow}
              disabled={executing || nodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {executing ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-0">
          {/* Workflows Sidebar */}
          <div className="col-span-2 h-full border-r border-grey-500 bg-white overflow-y-auto">
            <div className="p-3 border-b border-grey-500">
              <h2 className="text-sm font-semibold text-neutral-700">Workflows</h2>
            </div>
            <div className="p-2">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => loadWorkflow(workflow)}
                  className={`p-2 mb-2 rounded-lg border cursor-pointer transition-colors ${
                    activeWorkflow?.id === workflow.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-sidebar border-grey-500 hover:bg-grey-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-header truncate">
                        {workflow.name}
                      </h3>
                      <p className="text-xs text-light">{workflow.nodes.length} nodes</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWorkflow(workflow.id);
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Instruction Types Sidebar - Drag square icons */}
          <div className="col-span-1 h-full border-r border-grey-500 bg-white overflow-y-auto">
            <div className="p-3 border-b border-grey-500">
              <h2 className="text-sm font-semibold text-neutral-700 text-center">Icons</h2>
            </div>
            <div className="p-3 space-y-4">
              {/* File Operations */}
              <div>
                <h3 className="text-xs font-semibold text-light uppercase mb-2 text-center">File Ops</h3>
                <div className="flex flex-col items-center gap-3">
                  {(['read', 'write', 'edit', 'delete', 'search', 'save'] as InstructionType[]).map((type) => {
                    const typeInfo = INSTRUCTION_TYPES[type];
                    const Icon = typeInfo.icon;
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        className="cursor-move transition-transform hover:scale-110"
                        title={typeInfo.label}
                      >
                        <div
                          className="w-16 h-16 rounded shadow-md border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: typeInfo.color }}
                        >
                          <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="text-[10px] text-center mt-1 text-light font-medium">
                          {typeInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Operations */}
              <div>
                <h3 className="text-xs font-semibold text-light uppercase mb-2 text-center">AI Ops</h3>
                <div className="flex flex-col items-center gap-3">
                  {(['transform', 'extract', 'analyse', 'translate'] as InstructionType[]).map((type) => {
                    const typeInfo = INSTRUCTION_TYPES[type];
                    const Icon = typeInfo.icon;
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        className="cursor-move transition-transform hover:scale-110"
                        title={typeInfo.label}
                      >
                        <div
                          className="w-16 h-16 rounded shadow-md border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: typeInfo.color }}
                        >
                          <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="text-[10px] text-center mt-1 text-light font-medium">
                          {typeInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Code Operations */}
              <div>
                <h3 className="text-xs font-semibold text-light uppercase mb-2 text-center">Code Ops</h3>
                <div className="flex flex-col items-center gap-3">
                  {(['code', 'execute', 'debug', 'fix', 'test'] as InstructionType[]).map((type) => {
                    const typeInfo = INSTRUCTION_TYPES[type];
                    const Icon = typeInfo.icon;
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        className="cursor-move transition-transform hover:scale-110"
                        title={typeInfo.label}
                      >
                        <div
                          className="w-16 h-16 rounded shadow-md border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: typeInfo.color }}
                        >
                          <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="text-[10px] text-center mt-1 text-light font-medium">
                          {typeInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Flow Control */}
              <div>
                <h3 className="text-xs font-semibold text-light uppercase mb-2 text-center">Flow</h3>
                <div className="flex flex-col items-center gap-3">
                  {(['decide', 'loop', 'wait'] as InstructionType[]).map((type) => {
                    const typeInfo = INSTRUCTION_TYPES[type];
                    const Icon = typeInfo.icon;
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        className="cursor-move transition-transform hover:scale-110"
                        title={typeInfo.label}
                      >
                        <div
                          className="w-16 h-16 rounded shadow-md border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: typeInfo.color }}
                        >
                          <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="text-[10px] text-center mt-1 text-light font-medium">
                          {typeInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Integration */}
              <div>
                <h3 className="text-xs font-semibold text-light uppercase mb-2 text-center">Integration</h3>
                <div className="flex flex-col items-center gap-3">
                  {(['http', 'passTo', 'compare', 'correct'] as InstructionType[]).map((type) => {
                    const typeInfo = INSTRUCTION_TYPES[type];
                    const Icon = typeInfo.icon;
                    return (
                      <div
                        key={type}
                        draggable
                        onDragStart={(e) => onDragStart(e, type)}
                        className="cursor-move transition-transform hover:scale-110"
                        title={typeInfo.label}
                      >
                        <div
                          className="w-16 h-16 rounded shadow-md border-2 bg-white flex items-center justify-center"
                          style={{ borderColor: typeInfo.color }}
                        >
                          <Icon className="w-8 h-8" style={{ color: typeInfo.color }} />
                        </div>
                        <div className="text-[10px] text-center mt-1 text-light font-medium">
                          {typeInfo.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="col-span-7 h-full bg-grey-400">
            {activeWorkflow ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onDrop={onDrop}
                onDragOver={onDragOver}
                nodeTypes={nodeTypes}
                fitView
                panOnScroll
                selectionOnDrag
                panOnDrag={[1, 2]}
              >
                <Background />
                <Controls />
              </ReactFlow>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-light">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold">No workflow selected</p>
                  <p className="text-sm mt-2">Create or select a workflow to get started</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Node Config or Execution Log */}
          <div className="col-span-2 h-full bg-sidebar border-l border-grey-500 flex flex-col overflow-hidden">
            {selectedNode ? (
              <>
                <div className="p-3 border-b border-grey-500">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold text-header">Node Config</h2>
                    <button
                      onClick={() => deleteNode(selectedNode.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-light">
                    {INSTRUCTION_TYPES[selectedNode.data.type as InstructionType].description}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Label
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.label || ''}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, label: e.target.value } }
                                : n
                            )
                          );
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Node label"
                      />
                    </div>

                    {/* MCP Server Selection */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        MCP Server
                      </label>
                      <select
                        value={selectedNode.data.mcpServer || ''}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, mcpServer: e.target.value } }
                                : n
                            )
                          );
                        }}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                      >
                        <option value="">Select MCP Server...</option>
                        {mcpServers.map((server: any) => (
                          <option key={server.id} value={server.id}>
                            {server.name}
                          </option>
                        ))}
                      </select>
                      {selectedNode.data.mcpServer && (
                        <p className="text-xs text-light mt-1">
                          {mcpServers.find((s: any) => s.id === selectedNode.data.mcpServer)?.description}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Configuration (JSON)
                      </label>
                      <textarea
                        value={JSON.stringify(selectedNode.data.config || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const config = JSON.parse(e.target.value);
                            updateNodeConfig(selectedNode.id, config);
                          } catch (err) {
                            // Invalid JSON
                          }
                        }}
                        className="w-full h-48 px-2 py-2 text-xs border border-gray-300 rounded font-mono focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder='{\n  "key": "value"\n}'
                      />
                    </div>

                    {/* Test and Debug Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestNode(selectedNode)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <TestTube className="w-4 h-4" />
                        Test
                      </button>
                      <button
                        onClick={() => handleDebugNode(selectedNode)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        <Bug className="w-4 h-4" />
                        Debug
                      </button>
                    </div>

                    {/* Logs Section */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Logs
                      </label>
                      <div className="w-full h-32 px-2 py-2 text-xs border border-gray-300 rounded bg-gray-900 text-gray-100 font-mono overflow-y-auto">
                        {selectedNode.data.logs && selectedNode.data.logs.length > 0 ? (
                          selectedNode.data.logs.map((log: string, idx: number) => (
                            <div key={idx} className="mb-1">
                              {log}
                            </div>
                          ))
                        ) : (
                          <div className="text-light italic">No logs yet</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : executionLog.length > 0 ? (
              <>
                <div className="p-3 border-b border-grey-500">
                  <h2 className="text-sm font-semibold text-header">Execution Log</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3 bg-gray-900 text-gray-100 font-mono text-xs">
                  {executionLog.map((log, idx) => (
                    <div key={idx} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-light p-4">
                <div className="text-center">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Click a node to configure it</p>
                  <p className="text-xs mt-2 text-gray-400">
                    Or drag & drop nodes from the left panel
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
