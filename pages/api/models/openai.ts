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
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    const data = await response.json();

    // Filter to only chat completion models and sort by ID
    const chatModels = data.data
      .filter((model: any) =>
        model.id.includes('gpt') &&
        !model.id.includes('instruct') &&
        !model.id.includes('vision')
      )
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        created: model.created,
      }))
      .sort((a: any, b: any) => b.created - a.created);

    return res.status(200).json({
      models: chatModels,
      count: chatModels.length,
      provider: 'openai',
    });
  } catch (error: any) {
    console.error('OpenAI models fetch error:', error);
    return res.status(500).json({
      error: error.message,
      fallback: [
        { id: 'gpt-4o', name: 'gpt-4o' },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
        { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
      ]
    });
  }
}
