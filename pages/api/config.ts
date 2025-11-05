import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

// This stores PowerNode configuration in Azure Table Storage
// Configuration is stored per creator

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeconfig';

interface AIProvider {
  enabled: boolean;
  apiKey: string;
  model: string;
  endpoint?: string;
  deployment?: string;
}

interface PowerNodeConfig {
  // Partition and row keys for Azure Table Storage
  partitionKey: string; // creator_id
  rowKey: string; // Always 'config'

  // NEW Multi-Provider Configuration (stored as JSON string)
  providers?: string; // JSON: { openai: AIProvider, anthropic: AIProvider, etc }
  defaultProvider?: 'openai' | 'anthropic' | 'google' | 'mistral' | 'azureOpenAI';

  // AI Configuration
  temperature?: number;
  maxTokens?: number;

  // System Prompt
  systemPrompt?: string;

  // MCP Tool Custom Prompts (stored as JSON string)
  customPrompts?: string;

  // Metadata
  updatedAt?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get creator ID from query or default to 'default-user'
  const creatorId = (req.query.creatorId as string) || 'default-user';

  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({
      error: 'Storage connection not configured',
      message: 'POWERNODE_STORAGE_CONNECTION environment variable is missing',
    });
  }

  try {
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

    // Ensure table exists
    await tableClient.createTable().catch(() => {
      // Ignore error if table already exists
    });

    if (req.method === 'GET') {
      // Get configuration
      try {
        const entity = await tableClient.getEntity<PowerNodeConfig>(creatorId, 'config');

        // Parse providers and custom prompts JSON
        const providers = entity.providers ? JSON.parse(entity.providers) : {};
        const customPrompts = entity.customPrompts ? JSON.parse(entity.customPrompts) : {};

        // Return config as-is (no masking - frontend handles display)
        const config = {
          providers,
          defaultProvider: entity.defaultProvider || 'anthropic',
          temperature: entity.temperature ?? 0.7,
          maxTokens: entity.maxTokens ?? 4096,
          systemPrompt: entity.systemPrompt || '',
          customPrompts,
        };

        return res.status(200).json(config);
      } catch (error: any) {
        if (error.statusCode === 404) {
          // Return default configuration if not found
          return res.status(200).json({
            providers: {},
            defaultProvider: 'anthropic',
            temperature: 0.7,
            maxTokens: 4096,
            systemPrompt: '',
            customPrompts: {},
          });
        }
        throw error;
      }
    } else if (req.method === 'POST') {
      // Save configuration
      const body = req.body;

      // Prepare entity for Table Storage - save exactly what's sent
      const entity: PowerNodeConfig = {
        partitionKey: creatorId,
        rowKey: 'config',
        providers: JSON.stringify(body.providers || {}),
        defaultProvider: body.defaultProvider || 'anthropic',
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens ?? 4096,
        systemPrompt: body.systemPrompt || '',
        customPrompts: JSON.stringify(body.customPrompts || {}),
        updatedAt: new Date().toISOString(),
      };

      // Upsert the configuration
      await tableClient.upsertEntity(entity, 'Replace');

      return res.status(200).json({
        success: true,
        message: 'Configuration saved successfully',
        creatorId,
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Config API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * Mask secret values for security
 */
function maskSecret(value: string): string {
  if (!value || value.length < 8) {
    return '***';
  }
  return value.substring(0, 4) + '***' + value.substring(value.length - 4);
}
