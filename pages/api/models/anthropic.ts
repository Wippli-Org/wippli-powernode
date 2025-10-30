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
    // Anthropic doesn't have a /v1/models endpoint
    // Return latest models from their docs (updated Oct 30, 2025)
    const models = [
      // Claude 4.5 Series (Latest - October 2025)
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Sep 2025) ⭐ LATEST' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 (auto-updates to latest)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Oct 2025)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (auto-updates to latest)' },
      { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1 (Aug 2025)' },
      { id: 'claude-opus-4-1', name: 'Claude Opus 4.1 (auto-updates to latest)' },

      // Claude 4 Series (May 2025)
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (May 2025)' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4 (May 2025)' },

      // Claude 3.7 Series (February 2025)
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7 (Feb 2025)' },

      // Claude 3.5 Series (Legacy - 2024)
      { id: 'claude-3-5-haiku-20241022', name: 'Claude Haiku 3.5 (Oct 2024)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet 3.5 (Oct 2024)' },

      // Claude 3 Series (Legacy - Early 2024)
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Feb 2024)' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Mar 2024)' },
    ];

    // Verify API key works
    const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
    });

    if (!testResponse.ok) {
      throw new Error('Invalid API key or model not accessible');
    }

    return res.status(200).json({
      models,
      count: models.length,
      provider: 'anthropic',
      note: 'Models from Anthropic docs (Oct 30, 2025). Visit https://docs.claude.com/en/docs/about-claude/models for updates.',
      lastUpdated: '2025-10-30',
    });
  } catch (error: any) {
    console.error('Anthropic models fetch error:', error);
    return res.status(500).json({
      error: error.message,
      fallback: [
        { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 (Latest)' },
        { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Latest)' },
        { id: 'claude-opus-4-1', name: 'Claude Opus 4.1 (Latest)' },
      ]
    });
  }
}
