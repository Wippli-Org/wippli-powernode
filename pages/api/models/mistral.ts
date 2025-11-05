import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models from Mistral AI API
 * GET /api/models/mistral?apiKey=YOUR_API_KEY
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
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from Mistral AI');
    }

    const data = await response.json();

    const models = data.data.map((model: any) => ({
      id: model.id,
      name: model.id,
      created: model.created,
    }));

    return res.status(200).json({
      success: true,
      models,
      provider: 'mistral',
    });
  } catch (error: any) {
    console.error('Error fetching Mistral AI models:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch models',
      fallback: [
        { id: 'mistral-large-latest', name: 'Mistral Large' },
        { id: 'mistral-medium-latest', name: 'Mistral Medium' },
        { id: 'mistral-small-latest', name: 'Mistral Small' },
        { id: 'open-mistral-nemo', name: 'Open Mistral Nemo' },
      ],
    });
  }
}
