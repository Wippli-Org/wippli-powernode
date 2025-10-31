import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeMcpServers';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { serverId, toolName, arguments: toolArgs, userId = 'default-user' } = req.body;

  if (!serverId || !toolName) {
    return res.status(400).json({ error: 'Missing serverId or toolName' });
  }

  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({ error: 'Storage connection not configured' });
  }

  try {
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

    // Get server configuration
    const serverEntity = await tableClient.getEntity(userId, serverId);

    const serverUrl = serverEntity.url as string;
    const apiKey = serverEntity.apiKey as string | undefined;

    // Prepare MCP request
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs || {},
      },
    };

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const startTime = Date.now();

    // Call MCP server
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(mcpRequest),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return res.status(response.status).json({
        error: `MCP server returned ${response.status}: ${response.statusText}`,
        latency,
      });
    }

    const result = await response.json();

    // Update server latency
    try {
      await tableClient.updateEntity(
        {
          partitionKey: userId,
          rowKey: serverId,
          latency,
          updatedAt: new Date().toISOString(),
        },
        'Merge'
      );
    } catch (error) {
      console.error('Error updating latency:', error);
      // Don't fail the request if latency update fails
    }

    return res.status(200).json({
      success: true,
      result: result.result,
      latency,
      executionTime: `${latency}ms`,
    });
  } catch (error: any) {
    console.error('Error executing tool:', error);

    return res.status(500).json({
      error: 'Failed to execute tool',
      message: error.message,
    });
  }
}
