import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const POWERNODE_STORAGE_CONNECTION =
      process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';

    if (!POWERNODE_STORAGE_CONNECTION) {
      return res.status(500).json({
        error: 'Storage connection not configured',
        hasConnection: false,
      });
    }

    const MCP_TABLE_NAME = 'powernodeMcpServers';
    const creatorId = 'default';
    const mcpTableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, MCP_TABLE_NAME);

    const mcpServers: any[] = [];
    const tools: any[] = [];

    try {
      const entities = mcpTableClient.listEntities({
        queryOptions: { filter: `PartitionKey eq '${creatorId}'` },
      });

      for await (const entity of entities) {
        const server = {
          id: entity.rowKey as string,
          name: entity.name as string,
          url: entity.url as string,
          hasApiKey: !!(entity.apiKey),
          tools: entity.tools ? JSON.parse(entity.tools as string) : [],
        };
        mcpServers.push(server);

        if (server.tools && server.tools.length > 0) {
          server.tools.forEach((tool: any) => {
            tools.push({
              name: tool.name,
              description: tool.description,
              serverId: server.id,
              serverName: server.name,
              hasInputSchema: !!tool.inputSchema,
              hasSchema: !!tool.schema,
            });
          });
        }
      }

      return res.status(200).json({
        success: true,
        hasConnection: true,
        tableName: MCP_TABLE_NAME,
        userId: creatorId,
        serverCount: mcpServers.length,
        toolCount: tools.length,
        servers: mcpServers,
        tools: tools,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
        hasConnection: true,
        tableAccessError: true,
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
