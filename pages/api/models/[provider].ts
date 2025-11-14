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
    let models: string[] = [];

    switch (provider) {
      case 'anthropic':
        // Anthropic doesn't have a public models endpoint
        // Return common model names
        models = [
          'claude-sonnet-4-5-20250929',
          'claude-sonnet-4-20250514',
          'claude-opus-4-20250514',
          'claude-3-5-sonnet-20241022',
          'claude-3-5-sonnet-20240620',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ];
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
            .map((m: any) => m.id)
            .sort();
        } else {
          throw new Error('Failed to fetch OpenAI models');
        }
        break;

      case 'azureOpenAI':
        // Azure OpenAI models are deployment-specific
        // Return common model names
        models = [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-35-turbo'
        ];
        break;

      case 'google':
        // Fetch Google/Gemini models
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (googleResponse.ok) {
          const data = await googleResponse.json();
          models = data.models
            .filter((m: any) => m.name.includes('gemini'))
            .map((m: any) => m.name.replace('models/', ''))
            .sort();
        } else {
          throw new Error('Failed to fetch Google models');
        }
        break;

      case 'deepseek':
        // DeepSeek doesn't have a public models endpoint
        // Return common model names
        models = [
          'deepseek-chat',
          'deepseek-coder'
        ];
        break;

      case 'ollama':
        // Fetch Ollama models from local instance
        const ollamaEndpoint = (endpoint as string) || 'http://localhost:11434';
        const ollamaResponse = await fetch(`${ollamaEndpoint}/api/tags`);

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          models = data.models?.map((m: any) => m.name) || [];
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

function getFallbackModels(provider: string): string[] {
  switch (provider) {
    case 'anthropic':
      return [
        'claude-sonnet-4-5-20250929',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229'
      ];
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
    case 'azureOpenAI':
      return ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'];
    case 'google':
      return ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    case 'deepseek':
      return ['deepseek-chat', 'deepseek-coder'];
    case 'ollama':
      return ['llama3.2', 'llama3.1', 'codellama'];
    default:
      return [];
  }
}
