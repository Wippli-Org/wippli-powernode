import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, endpoint } = req.query;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API key required' });
  }

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Endpoint URL required' });
  }

  try {
    // Azure OpenAI uses deployments, not models directly
    // We fetch the available deployments from the management API
    const deploymentsUrl = `${endpoint.replace(/\/$/, '')}/openai/deployments?api-version=2023-05-15`;

    const response = await fetch(deploymentsUrl, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI API returned ${response.status}`);
    }

    const data = await response.json();

    // Map deployments to model format
    const deployments = data.data.map((deployment: any) => ({
      id: deployment.id,
      name: `${deployment.id} (${deployment.model})`,
      model: deployment.model,
      status: deployment.status,
    }));

    return res.status(200).json({
      models: deployments,
      count: deployments.length,
      provider: 'azure-openai',
    });
  } catch (error: any) {
    console.error('Azure OpenAI models fetch error:', error);
    return res.status(500).json({
      error: error.message,
      fallback: [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-35-turbo', name: 'GPT-3.5 Turbo' },
      ]
    });
  }
}
