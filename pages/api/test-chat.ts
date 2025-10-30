import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, apiKey, model, message, endpoint, deployment } = req.body;

  if (!provider || !apiKey || !model || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    let response;

    switch (provider) {
      case 'openai':
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: message }],
            max_tokens: 150,
          }),
        });
        break;

      case 'anthropic':
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 150,
            messages: [{ role: 'user', content: message }],
          }),
        });
        break;

      case 'google':
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: message }] }],
            }),
          }
        );
        break;

      case 'mistral':
        response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: message }],
            max_tokens: 150,
          }),
        });
        break;

      case 'azureOpenAI':
        if (!endpoint || !deployment) {
          return res.status(400).json({ error: 'Azure endpoint and deployment required' });
        }
        response = await fetch(
          `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2023-05-15`,
          {
            method: 'POST',
            headers: {
              'api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: message }],
              max_tokens: 150,
            }),
          }
        );
        break;

      default:
        return res.status(400).json({ error: 'Unknown provider' });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract response based on provider
    let reply;
    switch (provider) {
      case 'openai':
      case 'mistral':
      case 'azureOpenAI':
        reply = data.choices[0].message.content;
        break;
      case 'anthropic':
        reply = data.content[0].text;
        break;
      case 'google':
        reply = data.candidates[0].content.parts[0].text;
        break;
      default:
        reply = JSON.stringify(data);
    }

    return res.status(200).json({
      success: true,
      reply,
      provider,
      model,
    });
  } catch (error: any) {
    console.error('Test chat error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get response from AI',
    });
  }
}
