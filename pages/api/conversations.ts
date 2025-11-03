import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeConversations';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  logs?: any[];
}

interface Conversation {
  id: string;
  name: string;
  userId: string;
  wippliId?: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
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
    if (error.statusCode !== 409) {
      console.error('Error creating table:', error);
    }
  }

  const userId = req.query.userId || req.body.userId || 'default-user';
  const wippliId = req.query.wippliId || req.body.wippliId;

  if (req.method === 'GET') {
    // Get all conversations for user
    try {
      const filter = wippliId
        ? `PartitionKey eq '${userId}' and wippliId eq '${wippliId}'`
        : `PartitionKey eq '${userId}'`;

      const entities = tableClient.listEntities({
        queryOptions: { filter },
      });

      const conversations: Conversation[] = [];
      for await (const entity of entities) {
        let messages = [];
        try {
          if (entity.messages && typeof entity.messages === 'string') {
            messages = JSON.parse(entity.messages);
          } else if (entity.messages && Array.isArray(entity.messages)) {
            messages = entity.messages;
          }
        } catch (error) {
          console.error(`Failed to parse messages for conversation ${entity.rowKey}:`, error);
          messages = [];
        }

        conversations.push({
          id: entity.rowKey as string,
          name: entity.name as string,
          userId: entity.partitionKey as string,
          wippliId: entity.wippliId as string | undefined,
          createdAt: entity.createdAt as string || new Date().toISOString(),
          updatedAt: entity.updatedAt as string || new Date().toISOString(),
          messages: messages,
        });
      }

      // Sort by updatedAt descending
      conversations.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return res.status(200).json({ conversations });
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  if (req.method === 'POST') {
    // Create or update conversation
    const { id, name, messages, wippliId: bodyWippliId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Conversation ID required' });
    }

    try {
      const now = new Date().toISOString();

      // Try to get existing conversation
      let existingConv;
      try {
        existingConv = await tableClient.getEntity(userId as string, id);
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
      }

      const entity = {
        partitionKey: userId as string,
        rowKey: id,
        name: name || existingConv?.name || `Conversation ${id.slice(0, 8)}`,
        wippliId: bodyWippliId || wippliId || existingConv?.wippliId || '',
        messages: JSON.stringify(messages || []),
        createdAt: existingConv?.createdAt || now,
        updatedAt: now,
      };

      if (existingConv) {
        await tableClient.updateEntity(entity, 'Merge');
      } else {
        await tableClient.createEntity(entity);
      }

      return res.status(200).json({
        success: true,
        conversation: {
          id,
          name: entity.name,
          userId: entity.partitionKey,
          wippliId: entity.wippliId,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          messages: messages || [],
        },
      });
    } catch (error: any) {
      console.error('Error saving conversation:', error);
      return res.status(500).json({ error: 'Failed to save conversation' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete conversation
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Conversation ID required' });
    }

    try {
      await tableClient.deleteEntity(userId as string, id);

      return res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      return res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
