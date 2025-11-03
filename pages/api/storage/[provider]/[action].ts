import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import formidable from 'formidable';
import fs from 'fs';

// Disable body parsing for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Lazy initialization of Azure Blob client
let blobServiceClient: BlobServiceClient | null = null;

function getBlobServiceClient(): BlobServiceClient {
  if (blobServiceClient) return blobServiceClient;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || process.env.POWERNODE_STORAGE_CONNECTION;
  if (!connectionString) {
    throw new Error('Azure Storage connection string not configured');
  }

  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return blobServiceClient;
}

async function parseForm(req: NextApiRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// AZURE BLOB STORAGE HANDLERS
async function handleBlobList(res: NextApiResponse) {
  try {
    const blobClient = getBlobServiceClient();
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const containerClient = blobClient.getContainerClient(containerName);

    // Check if container exists
    const exists = await containerClient.exists();
    if (!exists) {
      await containerClient.create();
    }

    const files: any[] = [];
    let totalSize = 0;

    for await (const blob of containerClient.listBlobsFlat()) {
      files.push({
        name: blob.name,
        size: blob.properties.contentLength || 0,
        lastModified: blob.properties.lastModified?.toISOString() || new Date().toISOString(),
        type: blob.properties.contentType,
        path: containerName,
      });
      totalSize += blob.properties.contentLength || 0;
    }

    res.status(200).json({ files, totalSize });
  } catch (error: any) {
    console.error('Blob list error:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
}

async function handleBlobStatus(res: NextApiResponse) {
  try {
    const blobClient = getBlobServiceClient();
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const containerClient = blobClient.getContainerClient(containerName);

    const exists = await containerClient.exists();

    if (!exists) {
      res.status(200).json({
        connected: false,
        fileCount: 0,
        usedSize: 0,
        totalSize: null, // Unlimited
      });
      return;
    }

    let fileCount = 0;
    let usedSize = 0;

    for await (const blob of containerClient.listBlobsFlat()) {
      fileCount++;
      usedSize += blob.properties.contentLength || 0;
    }

    res.status(200).json({
      connected: true,
      fileCount,
      usedSize,
      totalSize: null, // Azure Blob Storage doesn't have a fixed limit
    });
  } catch (error: any) {
    console.error('Blob status error:', error);
    res.status(200).json({
      connected: false,
      fileCount: 0,
      usedSize: 0,
      error: error.message,
    });
  }
}

async function handleBlobUpload(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { files } = await parseForm(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const blobClient = getBlobServiceClient();
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const containerClient = blobClient.getContainerClient(containerName);

    // Ensure container exists
    const exists = await containerClient.exists();
    if (!exists) {
      await containerClient.create();
    }

    const blockBlobClient = containerClient.getBlockBlobClient(file.originalFilename || file.newFilename);

    // Read file and upload
    const fileBuffer = fs.readFileSync(file.filepath);
    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype || 'application/octet-stream',
      },
    });

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    res.status(200).json({
      success: true,
      fileName: file.originalFilename || file.newFilename,
      size: file.size,
    });
  } catch (error: any) {
    console.error('Blob upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

async function handleBlobDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { fileName } = req.body;

    if (!fileName) {
      res.status(400).json({ error: 'File name is required' });
      return;
    }

    const blobClient = getBlobServiceClient();
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    await blockBlobClient.delete();

    res.status(200).json({ success: true, fileName });
  } catch (error: any) {
    console.error('Blob delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
}

async function handleBlobDownload(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { fileName } = req.query;

    if (!fileName || typeof fileName !== 'string') {
      res.status(400).json({ error: 'File name is required' });
      return;
    }

    const blobClient = getBlobServiceClient();
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file');
    }

    res.setHeader('Content-Type', downloadResponse.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', downloadResponse.contentLength || 0);

    downloadResponse.readableStreamBody.pipe(res);
  } catch (error: any) {
    console.error('Blob download error:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
}

// ONEDRIVE HANDLERS (Microsoft Graph API)
async function handleOneDriveList(req: NextApiRequest, res: NextApiResponse) {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      res.status(401).json({ error: 'OneDrive access token required' });
      return;
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }

    const data = await response.json();
    const files = data.value.map((item: any) => ({
      name: item.name,
      size: item.size || 0,
      lastModified: item.lastModifiedDateTime,
      type: item.file?.mimeType || 'folder',
      path: item.parentReference?.path || '',
      id: item.id,
    }));

    res.status(200).json({ files, totalSize: files.reduce((sum: number, f: any) => sum + f.size, 0) });
  } catch (error: any) {
    console.error('OneDrive list error:', error);
    res.status(500).json({ error: error.message || 'Failed to list files' });
  }
}

async function handleOneDriveStatus(req: NextApiRequest, res: NextApiResponse) {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      res.status(200).json({
        connected: false,
        fileCount: 0,
        usedSize: 0,
        totalSize: null,
        message: 'OneDrive access token not provided',
      });
      return;
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json({
      connected: true,
      fileCount: data.quota?.fileCount || 0,
      usedSize: data.quota?.used || 0,
      totalSize: data.quota?.total || null,
    });
  } catch (error: any) {
    console.error('OneDrive status error:', error);
    res.status(200).json({
      connected: false,
      fileCount: 0,
      usedSize: 0,
      totalSize: null,
      error: error.message,
    });
  }
}

async function handleOneDriveUpload(req: NextApiRequest, res: NextApiResponse) {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      res.status(401).json({ error: 'OneDrive access token required' });
      return;
    }

    const { files } = await parseForm(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const fileName = file.originalFilename || file.newFilename;

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': file.mimetype || 'application/octet-stream',
        },
        body: fileBuffer,
      }
    );

    if (!response.ok) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }

    const data = await response.json();

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    res.status(200).json({
      success: true,
      fileName: data.name,
      size: data.size,
      id: data.id,
      webUrl: data.webUrl,
    });
  } catch (error: any) {
    console.error('OneDrive upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
}

async function handleOneDriveDelete(req: NextApiRequest, res: NextApiResponse) {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');

    if (!accessToken) {
      res.status(401).json({ error: 'OneDrive access token required' });
      return;
    }

    const { fileId } = req.body;

    if (!fileId) {
      res.status(400).json({ error: 'File ID is required' });
      return;
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Microsoft Graph API error: ${response.status}`);
    }

    res.status(200).json({ success: true, fileId });
  } catch (error: any) {
    console.error('OneDrive delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
}

async function handleOneDriveDownload(req: NextApiRequest, res: NextApiResponse) {
  try {
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    const { fileId } = req.query;

    if (!accessToken) {
      res.status(401).json({ error: 'OneDrive access token required' });
      return;
    }

    if (!fileId || typeof fileId !== 'string') {
      res.status(400).json({ error: 'File ID is required' });
      return;
    }

    // Get file metadata
    const metadataResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      throw new Error(`Microsoft Graph API error: ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();

    // Download file content
    const downloadResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error(`Microsoft Graph API error: ${downloadResponse.status}`);
    }

    const fileBuffer = await downloadResponse.arrayBuffer();

    res.setHeader('Content-Type', metadata.file?.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.name}"`);
    res.setHeader('Content-Length', fileBuffer.byteLength);

    res.send(Buffer.from(fileBuffer));
  } catch (error: any) {
    console.error('OneDrive download error:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
}

// GOOGLE DRIVE HANDLERS (Placeholder - to be implemented)
async function handleGoogleDriveList(res: NextApiResponse) {
  res.status(501).json({
    error: 'Google Drive integration not yet implemented',
    files: [],
    message: 'Google Drive API integration coming soon',
  });
}

async function handleGoogleDriveStatus(res: NextApiResponse) {
  res.status(200).json({
    connected: false,
    fileCount: 0,
    usedSize: 0,
    totalSize: null,
    message: 'Google Drive integration coming soon',
  });
}

async function handleGoogleDriveUpload(res: NextApiResponse) {
  res.status(501).json({ error: 'Google Drive integration not yet implemented' });
}

async function handleGoogleDriveDelete(res: NextApiResponse) {
  res.status(501).json({ error: 'Google Drive integration not yet implemented' });
}

async function handleGoogleDriveDownload(res: NextApiResponse) {
  res.status(501).json({ error: 'Google Drive integration not yet implemented' });
}

// MAIN HANDLER
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provider, action } = req.query;

  if (typeof provider !== 'string' || typeof action !== 'string') {
    res.status(400).json({ error: 'Invalid provider or action' });
    return;
  }

  try {
    // Route to appropriate handler based on provider and action
    if (provider === 'blob') {
      switch (action) {
        case 'list':
          await handleBlobList(res);
          break;
        case 'status':
          await handleBlobStatus(res);
          break;
        case 'upload':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleBlobUpload(req, res);
          break;
        case 'delete':
          if (req.method !== 'DELETE') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleBlobDelete(req, res);
          break;
        case 'download':
          await handleBlobDownload(req, res);
          break;
        default:
          res.status(404).json({ error: 'Action not found' });
      }
    } else if (provider === 'onedrive') {
      switch (action) {
        case 'list':
          await handleOneDriveList(req, res);
          break;
        case 'status':
          await handleOneDriveStatus(req, res);
          break;
        case 'upload':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleOneDriveUpload(req, res);
          break;
        case 'delete':
          if (req.method !== 'DELETE') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleOneDriveDelete(req, res);
          break;
        case 'download':
          await handleOneDriveDownload(req, res);
          break;
        default:
          res.status(404).json({ error: 'Action not found' });
      }
    } else if (provider === 'googledrive') {
      switch (action) {
        case 'list':
          await handleGoogleDriveList(res);
          break;
        case 'status':
          await handleGoogleDriveStatus(res);
          break;
        case 'upload':
          await handleGoogleDriveUpload(res);
          break;
        case 'delete':
          await handleGoogleDriveDelete(res);
          break;
        case 'download':
          await handleGoogleDriveDownload(res);
          break;
        default:
          res.status(404).json({ error: 'Action not found' });
      }
    } else {
      res.status(400).json({ error: 'Invalid storage provider' });
    }
  } catch (error: any) {
    console.error(`Storage API error (${provider}/${action}):`, error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
