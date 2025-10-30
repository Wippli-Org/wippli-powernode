import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

// This stores PowerNode configuration in Azure Table Storage
// Configuration is stored per creator

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeconfig';

interface PowerNodeConfig {
  // Partition and row keys for Azure Table Storage
  partitionKey: string; // creator_id
  rowKey: string; // Always 'config'

  // AI Provider Configuration
  aiProvider: 'azure' | 'anthropic' | 'mistral';

  // Azure OpenAI
  azureOpenAIEndpoint?: string;
  azureOpenAIKey?: string;
  azureOpenAIDeployment?: string;
  azureOpenAIEmbeddingDeployment?: string;
  azureOpenAIApiVersion?: string;

  // Anthropic Claude
  anthropicApiKey?: string;

  // Mistral
  mistralApiKey?: string;

  // Storage Configuration
  powerNodeStorageConnection?: string;
  azureStorageAccount?: string;

  // AI Configuration
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;

  // MCP Tool Custom Prompts (stored as JSON string)
  customPrompts?: string;

  // Metadata
  updatedAt?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get creator ID from query or default to 'default'
  const creatorId = (req.query.creatorId as string) || 'default';

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

        // Parse custom prompts JSON
        const customPrompts = entity.customPrompts ? JSON.parse(entity.customPrompts) : {};

        // Remove Azure Table Storage metadata and partition/row keys
        const config = {
          aiProvider: entity.aiProvider || 'azure',
          azureOpenAIEndpoint: entity.azureOpenAIEndpoint || '',
          azureOpenAIKey: entity.azureOpenAIKey ? maskSecret(entity.azureOpenAIKey) : '',
          azureOpenAIDeployment: entity.azureOpenAIDeployment || 'gpt-4o-powerdocs',
          azureOpenAIEmbeddingDeployment: entity.azureOpenAIEmbeddingDeployment || 'text-embedding-3-large',
          azureOpenAIApiVersion: entity.azureOpenAIApiVersion || '2024-08-01-preview',
          anthropicApiKey: entity.anthropicApiKey ? maskSecret(entity.anthropicApiKey) : '',
          mistralApiKey: entity.mistralApiKey ? maskSecret(entity.mistralApiKey) : '',
          powerNodeStorageConnection: entity.powerNodeStorageConnection
            ? maskSecret(entity.powerNodeStorageConnection)
            : '',
          azureStorageAccount: entity.azureStorageAccount || 'powernodeexecutions',
          defaultModel: entity.defaultModel || 'gpt-4o',
          temperature: entity.temperature ?? 0.7,
          maxTokens: entity.maxTokens ?? 4096,
          customPrompts,
        };

        return res.status(200).json(config);
      } catch (error: any) {
        if (error.statusCode === 404) {
          // Return default configuration if not found
          return res.status(200).json({
            aiProvider: 'azure',
            azureOpenAIEndpoint: '',
            azureOpenAIKey: '',
            azureOpenAIDeployment: 'gpt-4o-powerdocs',
            azureOpenAIEmbeddingDeployment: 'text-embedding-3-large',
            azureOpenAIApiVersion: '2024-08-01-preview',
            anthropicApiKey: '',
            mistralApiKey: '',
            powerNodeStorageConnection: '',
            azureStorageAccount: 'powernodeexecutions',
            defaultModel: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 4096,
            customPrompts: {},
          });
        }
        throw error;
      }
    } else if (req.method === 'POST') {
      // Save configuration
      const body = req.body;

      // Validate required fields
      if (!body.aiProvider) {
        return res.status(400).json({ error: 'aiProvider is required' });
      }

      // Prepare entity for Table Storage
      const entity: PowerNodeConfig = {
        partitionKey: creatorId,
        rowKey: 'config',
        aiProvider: body.aiProvider,
        azureOpenAIEndpoint: body.azureOpenAIEndpoint,
        azureOpenAIKey: body.azureOpenAIKey,
        azureOpenAIDeployment: body.azureOpenAIDeployment,
        azureOpenAIEmbeddingDeployment: body.azureOpenAIEmbeddingDeployment,
        azureOpenAIApiVersion: body.azureOpenAIApiVersion,
        anthropicApiKey: body.anthropicApiKey,
        mistralApiKey: body.mistralApiKey,
        powerNodeStorageConnection: body.powerNodeStorageConnection,
        azureStorageAccount: body.azureStorageAccount,
        defaultModel: body.defaultModel,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
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
