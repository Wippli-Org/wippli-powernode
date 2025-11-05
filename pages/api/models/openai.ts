import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';

/**
 * Fetch available models from OpenAI API
 * GET /api/models/openai?creatorId=YOUR_CREATOR_ID
 *
 * Fetches the unmasked API key from storage for the given creatorId,
 * then uses it to fetch live models from OpenAI API
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const creatorId = req.query.creatorId as string;

  if (!creatorId) {
    return res.status(400).json({ error: 'creatorId is required' });
  }

  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({ error: 'Storage connection not configured' });
  }

  try {
    // Load unmasked API key from storage
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, 'powernodeconfig');
    const entity = await tableClient.getEntity(creatorId, 'config');
    const providers = entity.providers ? JSON.parse(entity.providers as string) : {};
    const openaiConfig = providers.openai;

    if (!openaiConfig || !openaiConfig.apiKey) {
      return res.status(400).json({
        error: 'OpenAI not configured',
        fallback: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        ],
      });
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${openaiConfig.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from OpenAI');
    }

    const data = await response.json();

    // Filter to only GPT models and sort by relevance
    const gptModels = data.data
      .filter((model: any) =>
        model.id.startsWith('gpt-') ||
        model.id.startsWith('o1-') ||
        model.id.startsWith('o3-')
      )
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        created: model.created,
      }))
      .sort((a: any, b: any) => {
        // Sort by creation date (newest first)
        return b.created - a.created;
      });

    return res.status(200).json({
      success: true,
      models: gptModels,
      provider: 'openai',
    });
  } catch (error: any) {
    console.error('Error fetching OpenAI models:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch models',
      fallback: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
      ],
    });
  }
}
