import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models from Anthropic API
 * GET /api/models/anthropic?apiKey=YOUR_API_KEY
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
    // Fetch models dynamically from Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from Anthropic API');
    }

    const data = await response.json();

    const models = data.data.map((model: any) => ({
      id: model.id,
      name: model.display_name || model.id,
      created: model.created_at,
      type: model.type,
    }));

    return res.status(200).json({
      success: true,
      models,
      provider: 'anthropic',
    });
  } catch (error: any) {
    console.error('Error fetching Anthropic models:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch models',
      fallback: [
        { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5' },
        { id: 'claude-3-opus-20240229', name: 'Claude Opus 3' },
      ],
    });
  }
}
