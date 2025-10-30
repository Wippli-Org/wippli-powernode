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
    // Fetch available models from Google AI API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google AI API returned ${response.status}`);
    }

    const data = await response.json();

    // Filter to only Gemini models that support generation
    const geminiModels = data.models
      .filter((model: any) =>
        model.name.includes('gemini') &&
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name.replace('models/', ''),
        description: model.description,
      }))
      .sort((a: any, b: any) => b.name.localeCompare(a.name));

    return res.status(200).json({
      models: geminiModels,
      count: geminiModels.length,
      provider: 'google',
    });
  } catch (error: any) {
    console.error('Google AI models fetch error:', error);
    return res.status(500).json({
      error: error.message,
      fallback: [
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      ]
    });
  }
}
