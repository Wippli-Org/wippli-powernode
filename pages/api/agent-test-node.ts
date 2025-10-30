import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { node, action, context } = req.body;

  if (!node || !action) {
    return res.status(400).json({ error: 'Missing required fields: node and action' });
  }

  try {
    if (action === 'test') {
      // Test the node configuration
      const result = await testNode(node);
      return res.status(200).json(result);
    } else if (action === 'debug') {
      // Debug the node with AI agent
      const result = await debugNodeWithAgent(node, context);
      return res.status(200).json(result);
    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Error in agent-test-node:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Test node function - validates configuration and simulates execution
async function testNode(node: any) {
  // Basic validation
  const errors: string[] = [];
  const details: string[] = [];

  // Check if node has required fields
  if (!node.type) {
    errors.push('Node type is missing');
  }

  if (!node.config || Object.keys(node.config).length === 0) {
    details.push('⚠ Warning: Node configuration is empty');
  }

  // Simulate testing based on node type
  details.push(`Testing ${node.type} instruction...`);

  // Add type-specific validations
  switch (node.type) {
    case 'read':
    case 'write':
    case 'edit':
    case 'delete':
      if (!node.config.path && !node.config.file) {
        errors.push('File path is required for file operations');
      } else {
        details.push('✓ File path configuration validated');
      }
      break;
    case 'http':
      if (!node.config.url) {
        errors.push('URL is required for HTTP requests');
      } else {
        details.push('✓ URL configuration validated');
      }
      break;
    case 'search':
      if (!node.config.query && !node.config.pattern) {
        errors.push('Search query or pattern is required');
      } else {
        details.push('✓ Search configuration validated');
      }
      break;
    default:
      details.push('✓ Basic configuration validated');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join(', '),
      details,
    };
  }

  return {
    success: true,
    message: 'All tests passed',
    details: [...details, '✓ Node is ready for execution'],
  };
}

// Debug node with AI agent - sends full context to AI for analysis
async function debugNodeWithAgent(node: any, context: any) {
  // Get configuration from environment or Azure Table Storage
  const storageConnection = process.env.POWERNODE_STORAGE_CONNECTION;

  if (!storageConnection) {
    console.warn('POWERNODE_STORAGE_CONNECTION not configured, using mock debug');
    return mockDebug(node, context);
  }

  try {
    // Import Azure packages dynamically
    const { TableClient } = await import('@azure/data-tables');

    // Get AI config from storage
    const tableClient = TableClient.fromConnectionString(
      storageConnection,
      'PowerNodeConfig'
    );

    let config: any = {
      providers: {
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || '',
          model: 'claude-sonnet-4-5-20250929',
        },
      },
      defaultProvider: 'anthropic',
    };

    try {
      const configEntity = await tableClient.getEntity('config', 'ai-config');
      if (configEntity.configData) {
        const storedConfig = JSON.parse(configEntity.configData as string);
        config = { ...config, ...storedConfig };
      }
    } catch (err) {
      console.log('Using default config');
    }

    const provider = config.defaultProvider || 'anthropic';
    const providerConfig = config.providers[provider];

    if (!providerConfig || !providerConfig.apiKey) {
      return mockDebug(node, context);
    }

    // Prepare the prompt for AI
    const prompt = `You are an AI agent helping debug a workflow node. Analyze the following node configuration and provide debugging insights.

**Node Information:**
- Type: ${node.type}
- Label: ${node.label || 'Untitled'}
- Configuration: ${JSON.stringify(node.config, null, 2)}

**Context:**
- Workflow: ${context?.workflow || 'Unknown'}
- Connected Nodes: ${JSON.stringify(context?.connectedNodes || [], null, 2)}

**Previous Logs:**
${node.logs && node.logs.length > 0 ? node.logs.join('\n') : 'No previous logs'}

Please provide:
1. Analysis of the node configuration
2. Potential issues or problems
3. Specific suggestions for fixes
4. Any configuration improvements

Keep your response concise and actionable.`;

    // Call AI provider
    if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: providerConfig.apiKey });

      const message = await anthropic.messages.create({
        model: providerConfig.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText =
        message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse the response to extract structured information
      const analysis = responseText;
      const suggestions: string[] = [];

      // Extract suggestions from the response
      const lines = responseText.split('\n');
      lines.forEach(line => {
        if (line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim())) {
          suggestions.push(line.trim().replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
        }
      });

      return {
        success: true,
        analysis: analysis.substring(0, 200) + (analysis.length > 200 ? '...' : ''),
        suggestions: suggestions.length > 0 ? suggestions.slice(0, 3) : ['Configuration looks good'],
        fixes: 'Agent analysis complete',
      };
    } else if (provider === 'azure') {
      const { OpenAIClient, AzureKeyCredential } = await import('@azure/openai');
      const client = new OpenAIClient(
        providerConfig.endpoint,
        new AzureKeyCredential(providerConfig.apiKey)
      );

      const result = await client.getChatCompletions(
        providerConfig.deployment,
        [{ role: 'user', content: prompt }],
        { maxTokens: 1024 }
      );

      const responseText = result.choices[0]?.message?.content || '';
      const suggestions: string[] = [];

      const lines = responseText.split('\n');
      lines.forEach(line => {
        if (line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim())) {
          suggestions.push(line.trim().replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));
        }
      });

      return {
        success: true,
        analysis: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
        suggestions: suggestions.length > 0 ? suggestions.slice(0, 3) : ['Configuration looks good'],
        fixes: 'Agent analysis complete',
      };
    }

    return mockDebug(node, context);
  } catch (error: any) {
    console.error('Error in debugNodeWithAgent:', error);
    return mockDebug(node, context);
  }
}

// Mock debug function for when AI is not available
function mockDebug(node: any, context: any) {
  const suggestions: string[] = [];

  // Basic analysis based on node type
  switch (node.type) {
    case 'read':
    case 'write':
    case 'edit':
    case 'delete':
      if (!node.config.path && !node.config.file) {
        suggestions.push('Add a file path to the configuration');
      }
      if (!node.config.encoding) {
        suggestions.push('Consider specifying encoding (e.g., utf-8)');
      }
      break;
    case 'http':
      if (!node.config.url) {
        suggestions.push('Add URL to the configuration');
      }
      if (!node.config.method) {
        suggestions.push('Specify HTTP method (GET, POST, etc.)');
      }
      break;
    case 'search':
      if (!node.config.query) {
        suggestions.push('Add search query to configuration');
      }
      break;
    default:
      suggestions.push('Review configuration for completeness');
  }

  if (suggestions.length === 0) {
    suggestions.push('Configuration looks complete');
  }

  return {
    success: true,
    analysis: `Node type: ${node.type}. Basic validation passed. ${
      context?.connectedNodes?.length > 0
        ? `Connected to ${context.connectedNodes.length} other node(s).`
        : 'No connections yet.'
    }`,
    suggestions,
    fixes: 'Mock analysis complete (AI not configured)',
  };
}
