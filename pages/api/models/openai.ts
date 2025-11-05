import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models from OpenAI API
 * GET /api/models/openai?apiKey=YOUR_API_KEY
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey } = req.query;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key is required' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
