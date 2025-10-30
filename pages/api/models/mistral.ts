import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey } = req.query;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key required' });
  }

  try {
    // Fetch models from Mistral API
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Mistral AI API returned ${response.status}`);
    }

    const data = await response.json();

    // Map and sort models
    const models = data.data
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        created: model.created,
      }))
      .sort((a: any, b: any) => b.created - a.created);

    return res.status(200).json({
      models,
      count: models.length,
      provider: 'mistral',
    });
  } catch (error: any) {
    console.error('Mistral AI models fetch error:', error);
    return res.status(500).json({
      error: error.message,
      fallback: [
        { id: 'mistral-large-latest', name: 'Mistral Large (Latest)' },
        { id: 'mistral-medium-latest', name: 'Mistral Medium (Latest)' },
        { id: 'mistral-small-latest', name: 'Mistral Small (Latest)' },
      ]
    });
  }
}
