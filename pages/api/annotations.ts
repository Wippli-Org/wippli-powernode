import { BlobServiceClient } from '@azure/storage-blob';
import type { NextApiRequest, NextApiResponse } from 'next';

const connectionString = process.env.AZURE_STORAGE_CONNECTION || process.env.POWERNODE_STORAGE_CONNECTION;
const containerName = 'pdf-annotations';

interface Annotation {
  id: string;
  type: string;
  content: any;
  timestamp: string;
  user?: string;
}

interface AnnotationDocument {
  wippliId: string;
  pdfName: string;
  pdfUrl: string;
  annotations: Annotation[];
  lastModified: string;
  version: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!connectionString) {
    return res.status(500).json({ error: 'Azure Storage not configured' });
  }

  const { wippliId, pdfName } = req.query;

  if (!wippliId || typeof wippliId !== 'string') {
    return res.status(400).json({ error: 'wippliId is required' });
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Ensure container exists
  await containerClient.createIfNotExists({ access: 'blob' });

  const blobName = `${wippliId}/annotations.json`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  if (req.method === 'GET') {
    try {
      // Get existing annotations
      const downloadResponse = await blockBlobClient.download(0);
      const downloadedContent = await streamToBuffer(downloadResponse.readableStreamBody!);
      const document: AnnotationDocument = JSON.parse(downloadedContent.toString());

      return res.status(200).json(document);
    } catch (error: any) {
      if (error.statusCode === 404) {
        // No annotations yet
        return res.status(200).json({
          wippliId,
          pdfName: pdfName || 'unknown',
          pdfUrl: '',
          annotations: [],
          lastModified: new Date().toISOString(),
          version: 0
        });
      }
      console.error('Error fetching annotations:', error);
      return res.status(500).json({ error: 'Failed to fetch annotations' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { annotations, pdfUrl } = req.body;

      if (!Array.isArray(annotations)) {
        return res.status(400).json({ error: 'annotations must be an array' });
      }

      const document: AnnotationDocument = {
        wippliId,
        pdfName: (pdfName as string) || 'unknown',
        pdfUrl: pdfUrl || '',
        annotations,
        lastModified: new Date().toISOString(),
        version: Date.now()
      };

      const content = JSON.stringify(document, null, 2);
      await blockBlobClient.upload(content, content.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/json'
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Annotations saved',
        annotationCount: annotations.length,
        wippliId
      });
    } catch (error) {
      console.error('Error saving annotations:', error);
      return res.status(500).json({ error: 'Failed to save annotations' });
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
