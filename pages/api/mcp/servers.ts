import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeMcpServers';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  apiKey?: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number;
  uptime: number;
  tools: any[];
  createdAt: string;
  updatedAt: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({ error: 'Storage connection not configured' });
  }

  const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

  // Ensure table exists
  try {
    await tableClient.createTable();
  } catch (error: any) {
    // Table might already exist, that's okay
    if (error.statusCode !== 409) {
      console.error('Error creating table:', error);
    }
  }

  const userId = req.query.userId || req.body.userId || 'default-user';

  if (req.method === 'GET') {
    // Get all MCP servers for user
    try {
      const entities = tableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${userId}'` },
      });

      const servers: MCPServer[] = [];
      for await (const entity of entities) {
        servers.push({
          id: entity.rowKey as string,
          name: entity.name as string,
          description: entity.description as string,
          url: entity.url as string,
          apiKey: entity.apiKey as string | undefined,
          status: (entity.status as 'healthy' | 'degraded' | 'down') || 'healthy',
          latency: (entity.latency as number) || 0,
          uptime: (entity.uptime as number) || 100,
          tools: entity.tools ? JSON.parse(entity.tools as string) : [],
          createdAt: entity.createdAt as string,
          updatedAt: entity.updatedAt as string,
        });
      }

      return res.status(200).json({ servers });
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      return res.status(500).json({ error: 'Failed to fetch servers' });
    }
  }

  if (req.method === 'POST') {
    // Add new MCP server
    const { id, name, description, url, apiKey } = req.body;

    if (!id || !name || !url) {
      return res.status(400).json({ error: 'Missing required fields: id, name, url' });
    }

    try {
      const now = new Date().toISOString();
      const entity = {
        partitionKey: userId as string,
        rowKey: id,
        name,
        description: description || '',
        url,
        apiKey: apiKey || '',
        status: 'healthy',
        latency: 0,
        uptime: 100,
        tools: JSON.stringify([]),
        createdAt: now,
        updatedAt: now,
      };

      await tableClient.createEntity(entity);

      return res.status(201).json({
        success: true,
        server: {
          id,
          name,
          description,
          url,
          apiKey,
          status: 'healthy',
          latency: 0,
          uptime: 100,
          tools: [],
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error: any) {
      console.error('Error creating server:', error);
      return res.status(500).json({ error: 'Failed to create server' });
    }
  }

  if (req.method === 'PUT') {
    // Update existing MCP server
    const { id, name, description, url, apiKey, tools, status, latency, uptime } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing server id' });
    }

    try {
      const entity = await tableClient.getEntity(userId as string, id);

      const updatedEntity = {
        partitionKey: userId as string,
        rowKey: id,
        name: name || entity.name,
        description: description !== undefined ? description : entity.description,
        url: url || entity.url,
        apiKey: apiKey !== undefined ? apiKey : entity.apiKey,
        tools: tools !== undefined ? JSON.stringify(tools) : entity.tools,
        status: status || entity.status,
        latency: latency !== undefined ? latency : entity.latency,
        uptime: uptime !== undefined ? uptime : entity.uptime,
        createdAt: entity.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await tableClient.updateEntity(updatedEntity, 'Merge');

      return res.status(200).json({
        success: true,
        message: 'Server updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating server:', error);
      return res.status(500).json({ error: 'Failed to update server' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete MCP server
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Missing server id' });
    }

    try {
      await tableClient.deleteEntity(userId as string, id);

      return res.status(200).json({
        success: true,
        message: 'Server deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting server:', error);
      return res.status(500).json({ error: 'Failed to delete server' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
