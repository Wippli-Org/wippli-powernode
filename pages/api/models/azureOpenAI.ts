import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Fetch available models/deployments from Azure OpenAI API
 * GET /api/models/azureOpenAI?apiKey=YOUR_API_KEY&endpoint=YOUR_ENDPOINT
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, endpoint } = req.query;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key is required' });
  }

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Endpoint URL is required' });
  }

  try {
    // Normalize endpoint URL - remove trailing slash and /deployments
    const baseUrl = endpoint.replace(/\/$/, '').replace(/\/deployments$/, '');

    // Azure OpenAI API uses deployments, not models
    // List deployments: GET {endpoint}/openai/deployments?api-version=2023-05-15
    const response = await fetch(
      `${baseUrl}/openai/deployments?api-version=2023-05-15`,
      {
        headers: {
          'api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch deployments: ${errorText}`);
    }

    const data = await response.json();

    const deployments = data.data?.map((deployment: any) => ({
      id: deployment.id,
      name: `${deployment.id} (${deployment.model})`,
      model: deployment.model,
      status: deployment.status,
    })) || [];

    return res.status(200).json({
      success: true,
      models: deployments,
      provider: 'azureOpenAI',
    });
  } catch (error: any) {
    console.error('Error fetching Azure OpenAI deployments:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch deployments',
      fallback: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo' },
      ],
    });
  }
}
