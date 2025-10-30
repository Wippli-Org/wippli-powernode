import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models from OpenRouter API
 * This ensures we always have the latest models - no hard-coded lists!
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json();

    // Sort models by popularity/usage (if available) or alphabetically
    const sortedModels = (data.data || []).sort((a: any, b: any) => {
      // Prioritize popular models
      const popularModels = [
        'openai/gpt-4o',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-pro-1.5',
        'meta-llama/llama-3.1-70b-instruct',
        'mistralai/mistral-large',
      ];

      const aIndex = popularModels.indexOf(a.id);
      const bIndex = popularModels.indexOf(b.id);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Otherwise sort by name
      return (a.name || a.id).localeCompare(b.name || b.id);
    });

    return res.status(200).json({
      models: sortedModels,
      count: sortedModels.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('OpenRouter models API error:', error);

    // Return fallback models if API fails
    return res.status(200).json({
      models: [
        {
          id: 'openai/gpt-4o',
          name: 'OpenAI: GPT-4o',
          pricing: { prompt: '0.000005', completion: '0.000015' },
          context_length: 128000,
        },
        {
          id: 'anthropic/claude-3.5-sonnet',
          name: 'Anthropic: Claude 3.5 Sonnet',
          pricing: { prompt: '0.000003', completion: '0.000015' },
          context_length: 200000,
        },
        {
          id: 'google/gemini-pro-1.5',
          name: 'Google: Gemini Pro 1.5',
          pricing: { prompt: '0.000003', completion: '0.000015' },
          context_length: 1000000,
        },
        {
          id: 'meta-llama/llama-3.1-70b-instruct',
          name: 'Meta: Llama 3.1 70B Instruct',
          pricing: { prompt: '0.00000088', completion: '0.00000088' },
          context_length: 131072,
        },
        {
          id: 'mistralai/mistral-large',
          name: 'Mistral: Large',
          pricing: { prompt: '0.000008', completion: '0.000024' },
          context_length: 128000,
        },
      ],
      count: 5,
      fallback: true,
      error: error.message,
    });
  }
}
