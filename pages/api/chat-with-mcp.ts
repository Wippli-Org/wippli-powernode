import type { NextApiRequest, NextApiResponse } from 'next';

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'AI';
  component: string;
  message: string;
  details?: any;
}

// MCP Gateway URL - disabled to prevent network interference
// const MCP_GATEWAY_URL = 'https://wippli-power-mcp.victoriousocean-8ee46cea.australiaeast.azurecontainerapps.io';

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

    // Load REAL configuration (server-side, direct access)
    addLog('INFO', 'Config Loader', 'Loading AI provider configuration...');

    // Import config handler directly to get unmasked keys (server-side only)
    const { TableClient } = await import('@azure/data-tables');

    const POWERNODE_STORAGE_CONNECTION =
      process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    const TABLE_NAME = 'powernodeconfig';
    const creatorId = 'default';

    if (!POWERNODE_STORAGE_CONNECTION) {
      throw new Error('Storage connection not configured');
    }

    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

    let config;
    try {
      const entity = await tableClient.getEntity(creatorId, 'config');
      const providers = entity.providers ? JSON.parse(entity.providers as string) : {};
      config = {
        providers,
        defaultProvider: entity.defaultProvider || 'anthropic',
        temperature: entity.temperature ?? 0.7,
        maxTokens: entity.maxTokens ?? 4096,
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        throw new Error('No configuration found. Please configure AI providers first.');
      }
      throw error;
    }

    const provider = config.defaultProvider || 'anthropic';
    const providerConfig = config.providers?.[provider as keyof typeof config.providers];

    if (!providerConfig || !providerConfig.enabled || !providerConfig.apiKey) {
      throw new Error('Please configure and enable a default AI provider first');
    }

    addLog('SUCCESS', 'Config Loader', 'Configuration loaded successfully', {
      provider,
      model: providerConfig.model,
      temperature: config.temperature || 0.7,
    });

    // MCP Integration - DISABLED to prevent network interference
    // TODO: Re-enable when MCP gateway is properly configured
    const requiresMCP = false; // Disabled - was causing network connection issues
    let mcpContext = '';

    // Commented out MCP calls - keeping code for future use
    /*
    if (requiresMCP) {
      addLog('INFO', 'MCP Router', 'MCP tool execution disabled');
    }
    */

    // Call REAL AI API
    addLog('INFO', 'AI Provider', `Using ${provider} provider`);

    const conversationLength = (conversationHistory?.length || 0) + 1;
    const messages = [
      ...(conversationHistory || []),
      { role: 'user', content: message + mcpContext }
    ];

    addLog('AI', providerConfig.model, `Processing conversation`, {
      messages: conversationLength,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      mcpContextIncluded: mcpContext.length > 0,
    });

    // Make REAL API call to Claude
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

    // Calculate REAL cost
    const cost = ((inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000)).toFixed(4);

    addLog('SUCCESS', providerConfig.model, `AI response received (${aiDuration}ms)`, {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: `$${cost}`,
      stopReason: data.stop_reason,
    });

    // Get REAL rate limit status from Anthropic headers
    const rateLimitRemaining = response.headers.get('anthropic-ratelimit-requests-remaining');
    const rateLimitLimit = response.headers.get('anthropic-ratelimit-requests-limit');
    const rateLimitReset = response.headers.get('anthropic-ratelimit-requests-reset');

    if (rateLimitRemaining && rateLimitLimit) {
      const remaining = parseInt(rateLimitRemaining);
      const limit = parseInt(rateLimitLimit);
      const used = limit - remaining;
      const percentage = (used / limit) * 100;

      if (percentage > 70) {
        addLog('WARN', 'Rate Limiter', `Rate limit threshold approaching (${used}/${limit} requests in window)`, {
          remaining,
          limit,
          resetTime: rateLimitReset,
          percentageUsed: `${percentage.toFixed(1)}%`,
        });
      } else {
        addLog('INFO', 'Rate Limiter', `Rate limits: ${used}/${limit} requests used (${percentage.toFixed(1)}%)`);
      }
    }

    addLog('SUCCESS', 'PowerNode Chat', `Response ready (${Date.now() - startTime}ms total)`);

    return res.status(200).json({
      success: true,
      reply,
      logs,
      metadata: {
        provider,
        model: providerConfig.model,
        tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
        cost: parseFloat(cost),
        duration: Date.now() - startTime,
        mcpCallsMade: requiresMCP,
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
