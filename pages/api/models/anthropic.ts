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
    // Anthropic doesn't have a models list endpoint, so we return a curated list
    // of current Claude models with their capabilities
    const models = [
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5 (Latest)',
        description: 'Most capable model, best for complex tasks',
        context: '200K tokens',
      },
      {
        id: 'claude-sonnet-4-0',
        name: 'Claude Sonnet 4.0',
        description: 'Previous generation Sonnet',
        context: '200K tokens',
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet (Oct 2024)',
        description: 'Balanced performance and speed',
        context: '200K tokens',
      },
      {
        id: 'claude-3-5-sonnet-20240620',
        name: 'Claude 3.5 Sonnet (Jun 2024)',
        description: 'Earlier version of 3.5 Sonnet',
        context: '200K tokens',
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        description: 'Fast and affordable',
        context: '200K tokens',
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku (Oct 2024)',
        description: 'Fast responses, lower cost',
        context: '200K tokens',
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful Claude 3 model',
        context: '200K tokens',
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced Claude 3 model',
        context: '200K tokens',
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest Claude 3 model',
        context: '200K tokens',
      },
    ];

    // Verify API key is valid by making a small test request
    try {
      const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.error?.message || 'Invalid API key');
      }
    } catch (error: any) {
      return res.status(401).json({
        error: 'Invalid Anthropic API key',
        details: error.message,
      });
    }

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
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      ],
    });
  }
}
