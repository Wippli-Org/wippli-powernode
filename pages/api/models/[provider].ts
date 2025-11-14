import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, apiKey, endpoint } = req.query;

  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'Provider and API key required' });
  }

  try {
    let models: any[] = [];

    switch (provider) {
      case 'anthropic':
        // Fetch models from Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey as string,
            'anthropic-version': '2023-06-01'
          }
        });

        if (anthropicResponse.ok) {
          const data = await anthropicResponse.json();
          models = data.data.map((m: any) => ({
            id: m.id,
            name: m.display_name || m.id
          }));
        } else {
          throw new Error('Failed to fetch Anthropic models');
        }
        break;

      case 'openai':
        // Fetch OpenAI models
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });

        if (openaiResponse.ok) {
          const data = await openaiResponse.json();
          models = data.data
            .filter((m: any) => m.id.includes('gpt'))
            .map((m: any) => ({
              id: m.id,
              name: m.id
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));
        } else {
          throw new Error('Failed to fetch OpenAI models');
        }
        break;

      case 'azureOpenAI':
        // Azure OpenAI models are deployment-specific
        // Return common model names
        const azureModels = [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-35-turbo'
        ];
        models = azureModels.map(id => ({ id, name: id }));
        break;

      case 'google':
        // Fetch Google/Gemini models
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (googleResponse.ok) {
          const data = await googleResponse.json();
          models = data.models
            .filter((m: any) => m.name.includes('gemini'))
            .map((m: any) => ({
              id: m.name.replace('models/', ''),
              name: m.displayName || m.name.replace('models/', '')
            }))
            .sort((a: any, b: any) => a.id.localeCompare(b.id));
        } else {
          throw new Error('Failed to fetch Google models');
        }
        break;

      case 'deepseek':
        // DeepSeek doesn't have a public models endpoint
        // Return common model names
        const deepseekModels = [
          'deepseek-chat',
          'deepseek-coder'
        ];
        models = deepseekModels.map(id => ({ id, name: id }));
        break;

      case 'ollama':
        // Fetch Ollama models from local instance
        const ollamaEndpoint = (endpoint as string) || 'http://localhost:11434';
        const ollamaResponse = await fetch(`${ollamaEndpoint}/api/tags`);

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          models = data.models?.map((m: any) => ({
            id: m.name,
            name: m.name
          })) || [];
        } else {
          throw new Error('Failed to fetch Ollama models');
        }
        break;

      default:
        return res.status(400).json({ error: 'Unknown provider' });
    }

    return res.status(200).json({ models });
  } catch (error: any) {
    console.error(`Error fetching models for ${provider}:`, error);

    // Return fallback models on error
    const fallback = getFallbackModels(provider as string);
    return res.status(200).json({
      models: [],
      fallback,
      error: error.message
    });
  }
}

function getFallbackModels(provider: string): any[] {
  const fallbacks: { [key: string]: string[] } = {
    'anthropic': ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-3-5-sonnet-20241022'],
    'openai': ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    'azureOpenAI': ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
    'google': ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    'deepseek': ['deepseek-chat', 'deepseek-coder'],
    'ollama': ['llama3.2', 'llama3.1', 'codellama']
  };

  const modelIds = fallbacks[provider] || [];
  return modelIds.map(id => ({ id, name: id }));
}
