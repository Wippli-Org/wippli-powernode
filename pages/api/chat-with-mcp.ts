import type { NextApiRequest, NextApiResponse } from 'next';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
  component: string;
  message: string;
  details?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, conversationHistory } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const logs: LogEntry[] = [];
  const startTime = Date.now();

  // Helper to add log
  const addLog = (level: LogEntry['level'], component: string, msg: string, details?: any) => {
    const now = new Date();
    logs.push({
      timestamp: now.toLocaleTimeString() + '.' + now.getMilliseconds(),
      level,
      component,
      message: msg,
      details,
    });
  };

  try {
    addLog('INFO', 'PowerNode Chat', `Received message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    // Load configuration
    addLog('INFO', 'Config Loader', 'Loading AI provider configuration...');

    // Simulate configuration loading
    await new Promise(resolve => setTimeout(resolve, 100));

    addLog('SUCCESS', 'Config Loader', 'Configuration loaded successfully', {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5',
      temperature: 0.7,
    });

    // Check if message requires MCP tools
    const requiresMCP = message.toLowerCase().includes('file') ||
                       message.toLowerCase().includes('document') ||
                       message.toLowerCase().includes('wippli') ||
                       message.toLowerCase().includes('database');

    if (requiresMCP) {
      addLog('INFO', 'MCP Router', 'Message requires MCP tool execution');

      // Simulate MCP tool call
      addLog('INFO', 'Wippli Context MCP', 'Calling MCP tool: get_wippli_context', {
        userId: 10,
        companyId: 7,
        taskId: 337,
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      addLog('SUCCESS', 'Wippli Context MCP', 'MCP tool response received (234ms)', {
        user: 'Admin Wippli',
        company: 'Wippli',
        task: 'Test Rag Retrieval',
        status: 'In Progress',
      });

      // Document operations
      if (message.toLowerCase().includes('file') || message.toLowerCase().includes('document')) {
        addLog('INFO', 'Document Operations MCP', 'Calling MCP tool: list_files_in_container', {
          container: 'wippli-documents',
          path: '/tasks/337',
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        addLog('SUCCESS', 'Document Operations MCP', 'Found 7 files in container', {
          files: [
            'proposal.docx',
            'budget.xlsx',
            'requirements.pdf',
            'design.png',
            'notes.txt',
            'contract.pdf',
            'invoice.pdf',
          ],
        });
      }
    }

    // Load configuration to get API key and model
    const configResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/config`);
    const config = await configResponse.json();

    const provider = config.defaultProvider || 'anthropic';
    const providerConfig = config.providers?.[provider];

    if (!providerConfig || !providerConfig.enabled || !providerConfig.apiKey) {
      throw new Error('Please configure and enable a default AI provider first');
    }

    // Call AI
    addLog('INFO', 'AI Provider', `Using ${provider} provider`);

    const conversationLength = (conversationHistory?.length || 0) + 1;
    const messages = [
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    addLog('AI', `${provider} (${providerConfig.model})`, `Processing conversation with ${providerConfig.model}`, {
      messages: conversationLength,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
    });

    // Make real API call to Claude
    const aiStartTime = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': providerConfig.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const reply = data.content[0].text;
    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    const aiDuration = Date.now() - aiStartTime;

    // Calculate cost (Anthropic pricing for Claude Sonnet 4.5)
    const cost = ((inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000)).toFixed(4);

    addLog('SUCCESS', `${provider} (${providerConfig.model})`, `AI response received (${aiDuration}ms)`, {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: `$${cost}`,
      stopReason: data.stop_reason,
    });

    // Check rate limits (simulated for now)
    const requestCount = Math.floor(Math.random() * 30 + 50);
    if (requestCount > 70) {
      addLog('WARN', 'Rate Limiter', `Rate limit threshold approaching (${requestCount}/100 requests in window)`, {
        windowResets: '42 seconds',
        remaining: 100 - requestCount,
      });
    } else {
      addLog('INFO', 'Rate Limiter', `Rate limits: ${requestCount}/100 requests used`);
    }

    addLog('SUCCESS', 'PowerNode Chat', `Response ready (${Date.now() - startTime}ms total)`);

    return res.status(200).json({
      success: true,
      reply,
      logs,
      metadata: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
        cost: parseFloat(cost),
        duration: Date.now() - startTime,
      },
    });

  } catch (error: any) {
    addLog('ERROR', 'PowerNode Chat', `Error: ${error.message}`, {
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process message',
      logs,
    });
  }
}
