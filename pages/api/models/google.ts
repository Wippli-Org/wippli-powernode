import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models from Google AI API
 * GET /api/models/google?apiKey=YOUR_API_KEY
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch models from Google AI');
    }

    const data = await response.json();

    // Filter to only Gemini models that support generateContent
    const geminiModels = data.models
      .filter((model: any) =>
        model.name.includes('gemini') &&
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name.replace('models/', ''),
        description: model.description,
      }));

    return res.status(200).json({
      success: true,
      models: geminiModels,
      provider: 'google',
    });
  } catch (error: any) {
    console.error('Error fetching Google AI models:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch models',
      fallback: [
        { id: 'gemini-2.5-pro-latest', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      ],
    });
  }
}
