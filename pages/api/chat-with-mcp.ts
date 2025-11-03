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

  const {
    message,
    conversationHistory,
    fileUrl,
    fileName,
    fileId,
    driveId,
    storageProvider,
    oneDriveConfig,
    conversationId,
    userId,
    wippliId,
  } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const effectiveUserId = userId || 'default-user';
  const effectiveConversationId = conversationId || `conv-${Date.now()}`;

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

    // OneDrive File Access - Download file if provided
    let fileContent: Buffer | null = null;
    let fileMetadata: any = null;

    if (storageProvider === 'onedrive' && oneDriveConfig?.accessToken && fileId) {
      addLog('INFO', 'OneDrive Storage', `Downloading file from OneDrive...`, { fileId, fileName });

      try {
        const downloadStartTime = Date.now();

        // Call our storage API to download the file
        const protocol = req.headers.host?.includes('localhost') ? 'http' : 'https';
        const downloadResponse = await fetch(
          `${protocol}://${req.headers.host}/api/storage/onedrive/download?fileId=${fileId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${oneDriveConfig.accessToken}`,
            },
          }
        );

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          throw new Error(`OneDrive download failed: ${downloadResponse.status} - ${errorText}`);
        }

        fileContent = Buffer.from(await downloadResponse.arrayBuffer());
        const downloadDuration = Date.now() - downloadStartTime;

        addLog('SUCCESS', 'OneDrive Storage', `File downloaded successfully (${downloadDuration}ms)`, {
          fileName,
          fileSize: `${(fileContent.length / 1024).toFixed(2)} KB`,
        });

        // Store file metadata for MCP tools
        fileMetadata = {
          name: fileName,
          id: fileId,
          driveId: driveId,
          url: fileUrl,
          size: fileContent.length,
          storageProvider: 'onedrive',
        };

      } catch (error: any) {
        addLog('ERROR', 'OneDrive Storage', `Failed to download file: ${error.message}`);
        // Don't fail the entire request, just log the error
        // MCP tools will get the file URL instead
      }
    }

    // Load REAL configuration (server-side, direct access)
    addLog('INFO', 'Config Loader', 'Loading AI provider configuration...');

    // Import config handler directly to get unmasked keys (server-side only)
    const { TableClient } = await import('@azure/data-tables');

    const POWERNODE_STORAGE_CONNECTION =
      process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    const TABLE_NAME = 'powernodeconfig';
    const creatorId = 'default-user';

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

    // MCP Integration - Fetch available MCP servers and their tools
    addLog('INFO', 'MCP Router', 'Fetching MCP servers and tools...');

    const MCP_TABLE_NAME = 'powernodeMcpServers';
    const mcpTableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, MCP_TABLE_NAME);

    const mcpServers: any[] = [];
    const tools: any[] = [];

    try {
      const entities = mcpTableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${creatorId}'` },
      });

      for await (const entity of entities) {
        const server = {
          id: entity.rowKey as string,
          name: entity.name as string,
          url: entity.url as string,
          apiKey: entity.apiKey as string | undefined,
          tools: entity.tools ? JSON.parse(entity.tools as string) : [],
        };
        mcpServers.push(server);

        // Add tools from this server to the tools array for Anthropic
        if (server.tools && server.tools.length > 0) {
          server.tools.forEach((tool: any) => {
            tools.push({
              name: `${server.id}__${tool.name}`,
              description: tool.description || `Tool from ${server.name}`,
              input_schema: tool.inputSchema || { type: 'object', properties: {} },
              _serverId: server.id, // Track which server this tool belongs to
              _originalName: tool.name, // Track original tool name
            });
          });
        }
      }

      addLog('SUCCESS', 'MCP Router', `Found ${mcpServers.length} MCP servers with ${tools.length} total tools`);
    } catch (error: any) {
      addLog('WARN', 'MCP Router', `Failed to load MCP servers: ${error.message}`);
    }

    // Call REAL AI API
    addLog('INFO', 'AI Provider', `Using ${provider} provider`);

    const conversationLength = (conversationHistory?.length || 0) + 1;
    const messages = [
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    addLog('AI', providerConfig.model, `Processing conversation`, {
      messages: conversationLength,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      toolsAvailable: tools.length,
    });

    // Make REAL API call to Claude
    const aiStartTime = Date.now();

    // Prepare request body with tools if available
    const requestBody: any = {
      model: providerConfig.model,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
      messages: messages,
    };

    // Only add tools parameter if we have tools
    if (tools.length > 0) {
      // Remove internal tracking fields before sending to API
      requestBody.tools = tools.map(({ _serverId, _originalName, ...tool }) => tool);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': providerConfig.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let inputTokens = data.usage.input_tokens;
    let outputTokens = data.usage.output_tokens;
    const aiDuration = Date.now() - aiStartTime;

    addLog('SUCCESS', providerConfig.model, `AI response received (${aiDuration}ms)`, {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      stopReason: data.stop_reason,
    });

    // Handle tool use with AGENTIC LOOP - allow multiple rounds of tool calls
    let reply = '';
    let currentMessages = messages;
    let currentResponse = data;
    let iteration = 0;
    let totalToolExecutions = 0; // Track total number of tool calls across all iterations
    const MAX_ITERATIONS = 5; // Prevent infinite loops

    // Keep calling tools until Claude stops requesting them or we hit max iterations
    while (currentResponse.stop_reason === 'tool_use' && iteration < MAX_ITERATIONS) {
      iteration++;
      addLog('INFO', 'Tool Router', `AI requested tool execution (iteration ${iteration}/${MAX_ITERATIONS})`);

      let toolResults: any[] = [];

      // Find all tool_use content blocks
      const toolUseBlocks = currentResponse.content.filter((block: any) => block.type === 'tool_use');

      for (const toolUse of toolUseBlocks) {
        const toolName = toolUse.name;
        const toolInput = toolUse.input;
        const toolUseId = toolUse.id;

        // Find the tool definition to get server info
        const toolDef = tools.find(t => t.name === toolName);
        if (!toolDef) {
          addLog('ERROR', 'Tool Router', `Tool not found: ${toolName}`);
          continue;
        }

        const serverId = toolDef._serverId;
        const originalToolName = toolDef._originalName;

        addLog('INFO', 'MCP Executor', `Executing ${originalToolName} on ${serverId}`, { input: toolInput });

        try {
          // Call our MCP execute-tool API
          const toolStartTime = Date.now();

          // Prepare tool execution payload
          const toolPayload: any = {
            serverId,
            toolName: originalToolName,
            arguments: toolInput,
            userId: creatorId,
          };

          // Pass file information if available
          if (fileMetadata) {
            toolPayload.fileMetadata = fileMetadata;
          }

          // Pass OneDrive config if file content was downloaded
          if (fileContent && oneDriveConfig) {
            toolPayload.storageConfig = {
              provider: 'onedrive',
              accessToken: oneDriveConfig.accessToken,
              fileContent: fileContent.toString('base64'), // Convert to base64 for JSON transport
            };
          }

          const toolResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/mcp/execute-tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolPayload),
          });

          const toolData = await toolResponse.json();
          const toolDuration = Date.now() - toolStartTime;

          if (toolData.success) {
            // MCP tools return {content: "..."} format - extract the content field
            const toolResultContent = toolData.result?.content || JSON.stringify(toolData.result);

            addLog('SUCCESS', 'MCP Executor', `Tool executed successfully (${toolDuration}ms)`, {
              result: typeof toolResultContent === 'string' ? toolResultContent.substring(0, 100) : toolResultContent,
            });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: toolResultContent,
            });
            totalToolExecutions++; // Count successful tool execution
          } else {
            addLog('ERROR', 'MCP Executor', `Tool execution failed: ${toolData.error}`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: `Error: ${toolData.error || 'Tool execution failed'}`,
              is_error: true,
            });
          }
        } catch (error: any) {
          addLog('ERROR', 'MCP Executor', `Failed to execute tool: ${error.message}`);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: `Error: ${error.message}`,
            is_error: true,
          });
        }
      }

      // Continue conversation with tool results
      addLog('INFO', 'AI Provider', 'Sending tool results back to AI');

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: currentResponse.content },
        { role: 'user', content: toolResults },
      ];

      const continuationStartTime = Date.now();
      const continuationResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
          messages: currentMessages,
          tools: requestBody.tools,
        }),
      });

      if (!continuationResponse.ok) {
        const errorText = await continuationResponse.text();
        throw new Error(`AI API error on continuation: ${continuationResponse.status} - ${errorText}`);
      }

      currentResponse = await continuationResponse.json();
      const continuationDuration = Date.now() - continuationStartTime;

      inputTokens += currentResponse.usage.input_tokens;
      outputTokens += currentResponse.usage.output_tokens;

      addLog('SUCCESS', providerConfig.model, `Continuation response received (${continuationDuration}ms)`, {
        inputTokens: currentResponse.usage.input_tokens,
        outputTokens: currentResponse.usage.output_tokens,
        stopReason: currentResponse.stop_reason,
      });
    }

    // Check if we hit max iterations
    if (iteration >= MAX_ITERATIONS && currentResponse.stop_reason === 'tool_use') {
      addLog('WARN', 'Tool Router', `Reached max iterations (${MAX_ITERATIONS}), stopping agentic loop`);
    }

    // Extract final text response
    reply = currentResponse.content.find((block: any) => block.type === 'text')?.text || '';

    // Calculate REAL cost
    const cost = ((inputTokens * 3 / 1000000) + (outputTokens * 15 / 1000000)).toFixed(4);

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

    // Save conversation to Azure Table Storage
    try {
      const conversationTableClient = TableClient.fromConnectionString(
        POWERNODE_STORAGE_CONNECTION,
        'powernodeConversations'
      );

      // Ensure table exists
      try {
        await conversationTableClient.createTable();
      } catch (err: any) {
        if (err.statusCode !== 409) {
          console.error('Error creating conversations table:', err);
        }
      }

      // Build updated messages array
      const updatedMessages = [
        ...(conversationHistory || []).map((m: any, idx: number) => ({
          id: `msg-${Date.now()}-${idx}`,
          role: m.role,
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
          logs: logs,
        },
      ];

      // Try to get existing conversation
      let existingConv;
      try {
        existingConv = await conversationTableClient.getEntity(
          effectiveUserId,
          effectiveConversationId
        );
      } catch (error: any) {
        if (error.statusCode !== 404) {
          console.error('Error fetching existing conversation:', error);
        }
      }

      const now = new Date().toISOString();
      const conversationEntity = {
        partitionKey: effectiveUserId,
        rowKey: effectiveConversationId,
        name: existingConv?.name || `Conversation ${effectiveConversationId.slice(-8)}`,
        wippliId: wippliId || existingConv?.wippliId || '',
        messages: JSON.stringify(updatedMessages),
        createdAt: existingConv?.createdAt || now,
        updatedAt: now,
      };

      if (existingConv) {
        await conversationTableClient.updateEntity(conversationEntity, 'Merge');
      } else {
        await conversationTableClient.createEntity(conversationEntity);
      }

      addLog('SUCCESS', 'Conversation Storage', 'Conversation saved to Azure Table Storage');
    } catch (error: any) {
      // Don't fail the request if conversation saving fails
      addLog('WARN', 'Conversation Storage', `Failed to save conversation: ${error.message}`);
    }

    return res.status(200).json({
      success: true,
      reply,
      logs,
      conversationId: effectiveConversationId,
      metadata: {
        provider,
        model: providerConfig.model,
        tokens: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
        cost: parseFloat(cost),
        duration: Date.now() - startTime,
        mcpToolsExecuted: totalToolExecutions,
        toolsAvailable: tools.length,
        fileMetadata: fileMetadata || undefined,
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
