import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';
import { BlobServiceClient } from '@azure/storage-blob';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeConversations';
const BLOB_CONTAINER = 'powernode-conversations';
const MAX_TABLE_SIZE = 60000; // 60KB limit (safe margin below 64KB)

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

// Helper function to save messages to blob storage
async function saveMessagesToBlob(userId: string, conversationId: string, messages: Message[]): Promise<string> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION);
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);

  // Ensure container exists
  await containerClient.createIfNotExists();

  const blobName = `${userId}/${conversationId}.json`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const messagesJson = JSON.stringify(messages);
  await blockBlobClient.upload(messagesJson, Buffer.byteLength(messagesJson), {
    blobHTTPHeaders: { blobContentType: 'application/json' }
  });

  return blobName;
}

// Helper function to load messages from blob storage
async function loadMessagesFromBlob(blobName: string): Promise<Message[]> {
  const blobServiceClient = BlobServiceClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION);
  const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const downloadResponse = await blockBlobClient.download();
  const downloaded = await streamToBuffer(downloadResponse.readableStreamBody!);
  return JSON.parse(downloaded.toString());
}

// Helper to convert stream to buffer
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
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
          // Check if messages are stored in blob storage
          if (entity.messagesBlob && typeof entity.messagesBlob === 'string') {
            messages = await loadMessagesFromBlob(entity.messagesBlob as string);
          } else if (entity.messages && typeof entity.messages === 'string') {
            messages = JSON.parse(entity.messages);
          } else if (entity.messages && Array.isArray(entity.messages)) {
            messages = entity.messages;
          }
        } catch (error) {
          console.error(`Failed to load messages for conversation ${entity.rowKey}:`, error);
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

      // Check if messages need to be stored in blob
      const messagesJson = JSON.stringify(messages || []);
      const messagesSize = Buffer.byteLength(messagesJson);
      const useBlobStorage = messagesSize > MAX_TABLE_SIZE;

      let entity: any = {
        partitionKey: userId as string,
        rowKey: id,
        name: name || existingConv?.name || `Conversation ${id.slice(0, 8)}`,
        wippliId: bodyWippliId || wippliId || existingConv?.wippliId || '',
        createdAt: existingConv?.createdAt || now,
        updatedAt: now,
      };

      if (useBlobStorage) {
        // Store messages in blob storage
        const blobName = await saveMessagesToBlob(userId as string, id, messages || []);
        entity.messagesBlob = blobName;
        entity.messages = `[BLOB:${messagesSize} bytes]`; // Store reference in table
        console.log(`💾 Large conversation (${(messagesSize/1024).toFixed(1)}KB) saved to blob: ${blobName}`);
      } else {
        // Store messages directly in table
        entity.messages = messagesJson;
        entity.messagesBlob = ''; // Clear any existing blob reference
      }

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
        storedInBlob: useBlobStorage,
        size: `${(messagesSize/1024).toFixed(1)}KB`
      });
    } catch (error: any) {
      console.error('Error saving conversation:', error);

      // Provide more detailed error message
      if (error.message && error.message.includes('PropertyValueTooLarge')) {
        return res.status(500).json({
          error: 'Conversation too large. Please try again.',
          details: 'PropertyValueTooLarge - implementing blob fallback...'
        });
      }

      return res.status(500).json({ error: 'Failed to save conversation', details: error.message });
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
