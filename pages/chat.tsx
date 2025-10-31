import { useState, useEffect, useRef } from 'react';
import { Send, Loader, AlertCircle, MessageSquare, Terminal, ChevronDown, ChevronRight, Trash2, Plus, Edit2, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  logs?: LogEntry[];
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
  component: string;
  message: string;
  details?: any;
  expanded?: boolean;
}

interface Conversation {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<any>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Get wippli_ID from localStorage or use 'default'
  const getWippliId = () => {
    return localStorage.getItem('wippli_id') || 'default';
  };

  const getStorageKey = (key: string) => {
    return `powernode-${getWippliId()}-${key}`;
  };

  // Load conversations from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem(getStorageKey('conversations'));
    const savedActiveId = localStorage.getItem(getStorageKey('active-conversation'));

    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        // Convert timestamp strings back to Date objects
        const conversationsWithDates = parsed.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        setConversations(conversationsWithDates);

        // Load active conversation
        if (savedActiveId && conversationsWithDates.find((c: Conversation) => c.id === savedActiveId)) {
          setActiveConversationId(savedActiveId);
          const activeConv = conversationsWithDates.find((c: Conversation) => c.id === savedActiveId);
          if (activeConv) {
            setMessages(activeConv.messages);
          }
        } else if (conversationsWithDates.length > 0) {
          // Default to first conversation
          setActiveConversationId(conversationsWithDates[0].id);
          setMessages(conversationsWithDates[0].messages);
        }
      } catch (err) {
        console.error('Failed to load saved conversations:', err);
      }
    } else {
      // Create first conversation if none exist
      createNewConversation();
    }
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(getStorageKey('conversations'), JSON.stringify(conversations));
    }
  }, [conversations]);

  // Save active conversation ID
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(getStorageKey('active-conversation'), activeConversationId);
    }
  }, [activeConversationId]);

  // Update messages in active conversation
  useEffect(() => {
    if (activeConversationId && messages.length > 0) {
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversationId
          ? { ...conv, messages, updatedAt: new Date() }
          : conv
      ));
    }
  }, [messages, activeConversationId]);

  useEffect(() => {
    // Load config to get selected model
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (showLogs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, showLogs]);

  const toggleLogExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'SUCCESS': return 'text-green-600 bg-green-50 border-green-200';
      case 'WARN': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'ERROR': return 'text-red-600 bg-red-50 border-red-200';
      case 'AI': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat-with-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        logs: data.logs || [],
      };

      setMessages([...messages, userMessage, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      name: `Conversation ${conversations.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };
    setConversations([newConv, ...conversations]);
    setActiveConversationId(newConv.id);
    setMessages([]);
  };

  const switchConversation = (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setActiveConversationId(convId);
      setMessages(conv.messages);
    }
  };

  const startRenameConversation = (convId: string, currentName: string) => {
    setEditingConversationId(convId);
    setEditingName(currentName);
  };

  const saveConversationName = () => {
    if (editingConversationId && editingName.trim()) {
      setConversations(prev => prev.map(conv =>
        conv.id === editingConversationId
          ? { ...conv, name: editingName.trim() }
          : conv
      ));
    }
    setEditingConversationId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingConversationId(null);
    setEditingName('');
  };

  const deleteConversation = (convId: string) => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      const newConversations = conversations.filter(c => c.id !== convId);
      setConversations(newConversations);

      // If deleting active conversation, switch to first available
      if (convId === activeConversationId) {
        if (newConversations.length > 0) {
          setActiveConversationId(newConversations[0].id);
          setMessages(newConversations[0].messages);
        } else {
          // Create new conversation if none left
          createNewConversation();
        }
      }

      // Clean up localStorage if no conversations left
      if (newConversations.length === 0) {
        localStorage.removeItem(getStorageKey('conversations'));
        localStorage.removeItem(getStorageKey('active-conversation'));
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PowerNode Chat</h1>
            <p className="text-sm text-gray-600">
              {config ? (
                <>
                  <span className="font-mono font-semibold text-primary">
                    {config.providers?.[config.defaultProvider]?.model || 'Not configured'}
                  </span>
                </>
              ) : (
                'Loading configuration...'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-0">
          {/* Conversations Sidebar */}
          <div className="col-span-12 lg:col-span-3 h-full border-r border-gray-200 overflow-hidden">
            <div className="bg-white h-full flex flex-col">
              {/* Sidebar Header */}
              <div className="p-4 border-b border-gray-200">
                <button
                  onClick={createNewConversation}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Conversation
                </button>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto p-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group mb-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      conv.id === activeConversationId
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => switchConversation(conv.id)}
                  >
                    <div className="flex items-center justify-between">
                      {editingConversationId === conv.id ? (
                        <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') saveConversationName();
                              if (e.key === 'Escape') cancelRename();
                            }}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={saveConversationName}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelRename}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {conv.name}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {conv.messages.length} messages
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startRenameConversation(conv.id, conv.name);
                              }}
                              className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-9 h-full grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
          {/* Chat Panel */}
          <div className="bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No messages yet. Start a conversation!</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="text-sm prose prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-purple-600">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                    <p className="text-xs mt-1 opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <Loader className="w-5 h-5 animate-spin text-gray-500" />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message... (Shift+Enter for new line)"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={2}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Execution Logs Panel */}
          <div className="bg-white flex flex-col h-full overflow-hidden">
            {/* Logs Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-gray-900">Execution Logs</h2>
              </div>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {showLogs ? 'Hide' : 'Show'}
              </button>
            </div>

            {/* Logs Content */}
            {showLogs && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                {messages.filter(m => m.logs && m.logs.length > 0).length === 0 && (
                  <div className="text-center text-gray-500 mt-8">
                    <Terminal className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="font-sans">No logs yet. Send a message to see execution logs.</p>
                  </div>
                )}

                {messages.map((message) =>
                  message.logs && message.logs.length > 0 ? message.logs.map((log, idx) => {
                    const logId = `${message.id}-${idx}`;
                    const isExpanded = expandedLogs.has(logId);

                    return (
                      <div
                        key={logId}
                        className={`border rounded p-3 ${getLevelColor(log.level)}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-gray-500">{log.timestamp}</span>
                            <span className="font-semibold">{log.level}</span>
                            <span className="text-gray-700">{log.component}</span>
                          </div>
                          {log.details && (
                            <button
                              onClick={() => toggleLogExpanded(logId)}
                              className="flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                        <p className="text-sm pl-0">{log.message}</p>

                        {isExpanded && log.details && (
                          <div className="mt-2 p-2 bg-black/5 rounded text-xs overflow-x-auto">
                            <pre>{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  }) : null
                )}

                <div ref={logsEndRef} />
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
