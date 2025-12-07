import { BlobServiceClient } from '@azure/storage-blob';
import type { NextApiRequest, NextApiResponse } from 'next';

const connectionString = process.env.AZURE_STORAGE_CONNECTION || process.env.POWERNODE_STORAGE_CONNECTION;
const containerName = 'pdf-annotations';

interface UserInfo {
  wippliId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  savedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!connectionString) {
    return res.status(500).json({ error: 'Azure Storage not configured' });
  }

  const { wippliId } = req.query;

  if (!wippliId || typeof wippliId !== 'string') {
    return res.status(400).json({ error: 'wippliId is required' });
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  await containerClient.createIfNotExists();

  const blobName = `${wippliId}/user-info.json`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  if (req.method === 'GET') {
    try {
      const downloadResponse = await blockBlobClient.download(0);
      const downloadedContent = await streamToBuffer(downloadResponse.readableStreamBody!);
      const userInfo: UserInfo = JSON.parse(downloadedContent.toString());

      return res.status(200).json(userInfo);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(200).json({
          wippliId,
          userId: null,
          userName: 'Guest',
          userEmail: null,
          userAvatar: null,
          savedAt: null
        });
      }
      console.error('Error fetching user info:', error);
      return res.status(500).json({ error: 'Failed to fetch user info' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { userId, userName, userEmail, userAvatar } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({ error: 'userId and userName are required' });
      }

      const userInfo: UserInfo = {
        wippliId,
        userId,
        userName,
        userEmail: userEmail || null,
        userAvatar: userAvatar || null,
        savedAt: new Date().toISOString()
      };

      const content = JSON.stringify(userInfo, null, 2);
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/json'
        }
      });

      return res.status(200).json({
        success: true,
        message: 'User info saved',
        wippliId
      });
    } catch (error) {
      console.error('Error saving user info:', error);
      return res.status(500).json({ error: 'Failed to save user info' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data: Buffer) => {
      chunks.push(data);
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
