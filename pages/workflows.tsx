import { useState, useEffect } from 'react';
import {
  Plus, Save, Play, Trash2, ChevronDown, ChevronRight, Settings,
  FileText, Edit3, FolderPlus, X, Search, GitBranch, Zap,
  RefreshCw, Clock, Globe, Code, Bug, CheckCircle, Copy,
  FileSearch, Languages, PlayCircle, TestTube, ArrowRight,
  Database, Send, AlertCircle, Loader
} from 'lucide-react';

// Instruction node types with icons and colors
const INSTRUCTION_TYPES = {
  // File Operations
  read: { label: 'Read', icon: FileText, color: 'bg-blue-500', description: 'Read files/data using MCP' },
  write: { label: 'Write', icon: FolderPlus, color: 'bg-green-500', description: 'Create new files/data' },
  edit: { label: 'Edit', icon: Edit3, color: 'bg-yellow-500', description: 'Modify existing content' },
  delete: { label: 'Delete', icon: Trash2, color: 'bg-red-500', description: 'Remove files/data' },
  search: { label: 'Search', icon: Search, color: 'bg-purple-500', description: 'Find content using MCP' },
  save: { label: 'Save', icon: Database, color: 'bg-teal-500', description: 'Save data to storage' },

  // AI Operations
  transform: { label: 'Transform', icon: Zap, color: 'bg-orange-500', description: 'Use Claude to process data' },
  extract: { label: 'Extract', icon: FileSearch, color: 'bg-indigo-500', description: 'Extract specific information' },
  analyse: { label: 'Analyse', icon: FileSearch, color: 'bg-pink-500', description: 'Analyze content with AI' },
  translate: { label: 'Translate', icon: Languages, color: 'bg-cyan-500', description: 'Translate text to another language' },

  // Code Operations
  code: { label: 'Code', icon: Code, color: 'bg-gray-700', description: 'Generate or execute code' },
  execute: { label: 'Execute', icon: PlayCircle, color: 'bg-violet-500', description: 'Execute a command or script' },
  debug: { label: 'Debug', icon: Bug, color: 'bg-red-600', description: 'Debug and find issues' },
  fix: { label: 'Fix', icon: CheckCircle, color: 'bg-green-600', description: 'Fix errors or issues' },
  test: { label: 'Test', icon: TestTube, color: 'bg-blue-600', description: 'Run tests or validations' },

  // Flow Control
  decide: { label: 'Decide', icon: GitBranch, color: 'bg-amber-500', description: 'Conditional branching (if/else)' },
  loop: { label: 'Loop', icon: RefreshCw, color: 'bg-lime-500', description: 'Iterate over items' },
  wait: { label: 'Wait', icon: Clock, color: 'bg-slate-500', description: 'Delay execution' },

  // Integration
  http: { label: 'HTTP', icon: Globe, color: 'bg-emerald-500', description: 'Call external APIs' },
  passTo: { label: 'Pass To', icon: Send, color: 'bg-sky-500', description: 'Pass data to another workflow/service' },
  compare: { label: 'Compare', icon: Copy, color: 'bg-fuchsia-500', description: 'Compare two values or datasets' },
  correct: { label: 'Correct', icon: CheckCircle, color: 'bg-rose-500', description: 'Correct or validate data' },
} as const;

type InstructionType = keyof typeof INSTRUCTION_TYPES;

interface Instruction {
  id: string;
  type: InstructionType;
  label: string;
  config: {
    [key: string]: any;
  };
  position: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  instructions: Instruction[];
  createdAt: Date;
  updatedAt: Date;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<Instruction | null>(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  // Load workflows from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('powernode-workflows');
    if (saved) {
      const parsed = JSON.parse(saved);
      const workflowsWithDates = parsed.map((w: any) => ({
        ...w,
        createdAt: new Date(w.createdAt),
        updatedAt: new Date(w.updatedAt),
      }));
      setWorkflows(workflowsWithDates);
      if (workflowsWithDates.length > 0) {
        setActiveWorkflow(workflowsWithDates[0]);
      }
    }
  }, []);

  // Save workflows to localStorage
  useEffect(() => {
    if (workflows.length > 0) {
      localStorage.setItem('powernode-workflows', JSON.stringify(workflows));
    }
  }, [workflows]);

  const createNewWorkflow = () => {
    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: `Workflow ${workflows.length + 1}`,
      description: 'New workflow',
      instructions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setWorkflows([...workflows, newWorkflow]);
    setActiveWorkflow(newWorkflow);
  };

  const addInstruction = (type: InstructionType) => {
    if (!activeWorkflow) return;

    const newInstruction: Instruction = {
      id: Date.now().toString(),
      type,
      label: INSTRUCTION_TYPES[type].label,
      config: {},
      position: activeWorkflow.instructions.length,
    };

    const updatedWorkflow = {
      ...activeWorkflow,
      instructions: [...activeWorkflow.instructions, newInstruction],
      updatedAt: new Date(),
    };

    setActiveWorkflow(updatedWorkflow);
    setWorkflows(workflows.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w));
    setShowTypeSelector(false);
    setSelectedInstruction(newInstruction);
  };

  const removeInstruction = (id: string) => {
    if (!activeWorkflow) return;

    const updatedWorkflow = {
      ...activeWorkflow,
      instructions: activeWorkflow.instructions
        .filter(i => i.id !== id)
        .map((i, idx) => ({ ...i, position: idx })),
      updatedAt: new Date(),
    };

    setActiveWorkflow(updatedWorkflow);
    setWorkflows(workflows.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w));
    if (selectedInstruction?.id === id) {
      setSelectedInstruction(null);
    }
  };

  const updateInstructionConfig = (id: string, config: any) => {
    if (!activeWorkflow) return;

    const updatedWorkflow = {
      ...activeWorkflow,
      instructions: activeWorkflow.instructions.map(i =>
        i.id === id ? { ...i, config: { ...i.config, ...config } } : i
      ),
      updatedAt: new Date(),
    };

    setActiveWorkflow(updatedWorkflow);
    setWorkflows(workflows.map(w => w.id === updatedWorkflow.id ? updatedWorkflow : w));
  };

  const executeWorkflow = async () => {
    if (!activeWorkflow || activeWorkflow.instructions.length === 0) return;

    setExecuting(true);
    setExecutionLog([]);

    const log = (message: string) => {
      setExecutionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    log('Starting workflow execution...');

    try {
      // TODO: Implement actual execution via API
      for (const instruction of activeWorkflow.instructions) {
        log(`Executing: ${instruction.label} (${instruction.type})`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate execution
        log(`✓ ${instruction.label} completed`);
      }
      log('Workflow completed successfully!');
    } catch (error: any) {
      log(`✗ Error: ${error.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const deleteWorkflow = (id: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      const newWorkflows = workflows.filter(w => w.id !== id);
      setWorkflows(newWorkflows);
      if (activeWorkflow?.id === id) {
        setActiveWorkflow(newWorkflows[0] || null);
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Builder</h1>
            <p className="text-sm text-gray-600">Build AI-powered workflows with MCP instructions</p>
          </div>
          <button
            onClick={createNewWorkflow}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-0">
          {/* Workflows Sidebar */}
          <div className="col-span-12 lg:col-span-2 h-full border-r border-gray-200 bg-white">
            <div className="h-full flex flex-col overflow-y-auto">
              <div className="p-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-700">My Workflows</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {workflows.map(workflow => (
                  <div
                    key={workflow.id}
                    onClick={() => setActiveWorkflow(workflow)}
                    className={`p-3 mb-2 rounded-lg border cursor-pointer transition-colors ${
                      activeWorkflow?.id === workflow.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{workflow.name}</h3>
                        <p className="text-xs text-gray-500">{workflow.instructions.length} steps</p>
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
          </div>

          {/* Workflow Canvas */}
          <div className="col-span-12 lg:col-span-7 h-full border-r border-gray-200 bg-white flex flex-col">
            {activeWorkflow ? (
              <>
                {/* Canvas Header */}
                <div className="flex-shrink-0 p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <input
                      type="text"
                      value={activeWorkflow.name}
                      onChange={(e) => {
                        const updated = { ...activeWorkflow, name: e.target.value, updatedAt: new Date() };
                        setActiveWorkflow(updated);
                        setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
                      }}
                      className="text-xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2"
                    />
                    <button
                      onClick={executeWorkflow}
                      disabled={executing || activeWorkflow.instructions.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {executing ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Run Workflow
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={activeWorkflow.description}
                    onChange={(e) => {
                      const updated = { ...activeWorkflow, description: e.target.value, updatedAt: new Date() };
                      setActiveWorkflow(updated);
                      setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
                    }}
                    placeholder="Add a description..."
                    className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-2 w-full"
                  />
                </div>

                {/* Instructions Flow */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeWorkflow.instructions.length === 0 ? (
                    <div className="text-center text-gray-500 mt-20">
                      <Zap className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-semibold mb-2">No instructions yet</p>
                      <p className="text-sm mb-6">Add your first instruction to start building your workflow</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeWorkflow.instructions.map((instruction, index) => {
                        const typeInfo = INSTRUCTION_TYPES[instruction.type];
                        const Icon = typeInfo.icon;
                        const isSelected = selectedInstruction?.id === instruction.id;

                        return (
                          <div key={instruction.id}>
                            <div
                              onClick={() => setSelectedInstruction(instruction)}
                              className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5 shadow-lg'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`${typeInfo.color} text-white rounded-lg p-3 flex-shrink-0`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-gray-500">#{index + 1}</span>
                                    <h3 className="text-sm font-semibold text-gray-900">{instruction.label}</h3>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{typeInfo.description}</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeInstruction(instruction.id);
                                  }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {index < activeWorkflow.instructions.length - 1 && (
                              <div className="flex justify-center py-2">
                                <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Instruction Button */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setShowTypeSelector(!showTypeSelector)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-dashed border-gray-300 text-gray-700 rounded-lg hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Add Instruction
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold">No workflow selected</p>
                  <p className="text-sm mt-2">Create or select a workflow to get started</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Instruction Config or Type Selector */}
          <div className="col-span-12 lg:col-span-3 h-full bg-white flex flex-col overflow-hidden">
            {showTypeSelector ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Select Instruction Type</h2>
                  <button
                    onClick={() => setShowTypeSelector(false)}
                    className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-6">
                    {/* File Operations */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">File Operations</h3>
                      <div className="space-y-2">
                        {(['read', 'write', 'edit', 'delete', 'search', 'save'] as InstructionType[]).map(type => {
                          const typeInfo = INSTRUCTION_TYPES[type];
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addInstruction(type)}
                              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div className={`${typeInfo.color} text-white rounded p-2`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
                                <p className="text-xs text-gray-500">{typeInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Operations */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Operations</h3>
                      <div className="space-y-2">
                        {(['transform', 'extract', 'analyse', 'translate'] as InstructionType[]).map(type => {
                          const typeInfo = INSTRUCTION_TYPES[type];
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addInstruction(type)}
                              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div className={`${typeInfo.color} text-white rounded p-2`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
                                <p className="text-xs text-gray-500">{typeInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Code Operations */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Code Operations</h3>
                      <div className="space-y-2">
                        {(['code', 'execute', 'debug', 'fix', 'test'] as InstructionType[]).map(type => {
                          const typeInfo = INSTRUCTION_TYPES[type];
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addInstruction(type)}
                              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div className={`${typeInfo.color} text-white rounded p-2`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
                                <p className="text-xs text-gray-500">{typeInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Flow Control */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Flow Control</h3>
                      <div className="space-y-2">
                        {(['decide', 'loop', 'wait'] as InstructionType[]).map(type => {
                          const typeInfo = INSTRUCTION_TYPES[type];
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addInstruction(type)}
                              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div className={`${typeInfo.color} text-white rounded p-2`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
                                <p className="text-xs text-gray-500">{typeInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Integration */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Integration</h3>
                      <div className="space-y-2">
                        {(['http', 'passTo', 'compare', 'correct'] as InstructionType[]).map(type => {
                          const typeInfo = INSTRUCTION_TYPES[type];
                          const Icon = typeInfo.icon;
                          return (
                            <button
                              key={type}
                              onClick={() => addInstruction(type)}
                              className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left"
                            >
                              <div className={`${typeInfo.color} text-white rounded p-2`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{typeInfo.label}</p>
                                <p className="text-xs text-gray-500">{typeInfo.description}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : selectedInstruction ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const typeInfo = INSTRUCTION_TYPES[selectedInstruction.type];
                      const Icon = typeInfo.icon;
                      return (
                        <>
                          <div className={`${typeInfo.color} text-white rounded p-2`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">{selectedInstruction.label}</h2>
                            <p className="text-xs text-gray-500">{typeInfo.description}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Configuration
                      </label>
                      <textarea
                        value={JSON.stringify(selectedInstruction.config, null, 2)}
                        onChange={(e) => {
                          try {
                            const config = JSON.parse(e.target.value);
                            updateInstructionConfig(selectedInstruction.id, config);
                          } catch (err) {
                            // Invalid JSON, ignore
                          }
                        }}
                        className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder='{\n  "key": "value"\n}'
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : executionLog.length > 0 ? (
              <>
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Execution Log</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm">
                  {executionLog.map((log, idx) => (
                    <div key={idx} className="mb-1">{log}</div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 p-6">
                <div className="text-center">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Select an instruction to configure it</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
