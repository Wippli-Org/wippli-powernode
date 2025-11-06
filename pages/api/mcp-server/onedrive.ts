import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

/**
 * OneDrive MCP Server - Pure TypeScript Implementation
 *
 * Provides MCP tools for OneDrive file operations
 * Uses PowerNode's OneDrive configuration from Azure Table Storage
 *
 * TOOLS:
 * 1. list_files - List all files in OneDrive root folder
 * 2. read_file - Read file contents from OneDrive
 * 3. upload_file - Upload a file to OneDrive
 * 4. delete_file - Delete a file from OneDrive
 * 5. download_url - Get temporary download URL for a file
 */

const ONEDRIVE_TABLE_NAME = 'powernodeOneDriveConfig';
const POWERNODE_STORAGE_CONNECTION = process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';

// Helper to refresh OneDrive access token
async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string, tenantId: string) {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite offline_access User.Read',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return await response.json();
}

// Helper to get OneDrive config and ensure token is valid
async function getOneDriveConfig(userId: string = 'default-user') {
  const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, ONEDRIVE_TABLE_NAME);
  const entity = await tableClient.getEntity(userId, 'onedrive-config');

  let accessToken = entity.accessToken as string;
  const refreshToken = entity.refreshToken as string;
  const expiresAt = entity.expiresAt as string;
  const clientId = entity.clientId as string;
  const clientSecret = entity.clientSecret as string;
  const tenantId = entity.tenantId as string;

  // Check if token is expired and refresh if needed
  if (new Date(expiresAt) <= new Date()) {
    console.log('OneDrive access token expired, refreshing...');
    const tokenData = await refreshAccessToken(clientId, clientSecret, refreshToken, tenantId);
    accessToken = tokenData.access_token;

    // Update the stored token
    const updatedEntity = {
      partitionKey: entity.partitionKey as string,
      rowKey: entity.rowKey as string,
      accessToken,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      clientId,
      clientSecret,
      tenantId,
      scopes: entity.scopes as string,
    };
    await tableClient.updateEntity(updatedEntity, 'Merge');
  }

  return { accessToken };
}

// MCP Tool Handlers
async function listFiles(userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.statusText}`);
  }

  const data = await response.json();
  const files = data.value.map((item: any) => ({
    id: item.id,
    name: item.name,
    size: item.size,
    modifiedAt: item.lastModifiedDateTime,
    webUrl: item.webUrl,
    downloadUrl: item['@microsoft.graph.downloadUrl'],
  }));

  return { files };
}

async function readFile(fileId: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  // Get download URL
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get file info: ${response.statusText}`);
  }

  const fileInfo = await response.json();
  const downloadUrl = fileInfo['@microsoft.graph.downloadUrl'];

  // Download file content
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
  }

  const content = await downloadResponse.text();
  return {
    name: fileInfo.name,
    size: fileInfo.size,
    content,
  };
}

async function uploadFile(fileName: string, content: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${fileName}:/content`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    size: data.size,
    webUrl: data.webUrl,
  };
}

async function deleteFile(fileId: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }

  return { success: true };
}

async function getDownloadUrl(fileId: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get file info: ${response.statusText}`);
  }

  const fileInfo = await response.json();
  return {
    downloadUrl: fileInfo['@microsoft.graph.downloadUrl'],
    expiresIn: '1 hour',
  };
}

async function getFolder(folderPath: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  // Normalize path - remove leading/trailing slashes
  const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');

  const encodedPath = encodeURIComponent(normalizedPath);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get folder: ${response.statusText}`);
  }

  const folderInfo = await response.json();
  return {
    id: folderInfo.id,
    name: folderInfo.name,
    path: folderInfo.parentReference?.path + '/' + folderInfo.name,
    webUrl: folderInfo.webUrl,
    createdDateTime: folderInfo.createdDateTime,
    lastModifiedDateTime: folderInfo.lastModifiedDateTime,
  };
}

async function listFolderContents(folderPath: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  // Normalize path - remove leading/trailing slashes
  const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');

  const encodedPath = encodeURIComponent(normalizedPath);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/children`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list folder contents: ${response.statusText}`);
  }

  const data = await response.json();
  const items = data.value.map((item: any) => ({
    id: item.id,
    name: item.name,
    type: item.folder ? 'folder' : 'file',
    size: item.size,
    modifiedAt: item.lastModifiedDateTime,
    webUrl: item.webUrl,
  }));

  return { items };
}

// MCP Protocol Handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jsonrpc, method, params, id } = req.body;

  // MCP Protocol v2023-11-05
  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: null,
    });
  }

  try {
    let result: any;

    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2023-11-05',
          serverInfo: {
            name: 'OneDrive MCP Server',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        };
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: 'list_files',
              description: 'List all files in OneDrive root folder. Returns file names, IDs, sizes, and modification dates.',
              inputSchema: {
                type: 'object',
                properties: {},
                required: [],
              },
            },
            {
              name: 'read_file',
              description: 'Read the contents of a file from OneDrive by file ID.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID',
                  },
                },
                required: ['fileId'],
              },
            },
            {
              name: 'upload_file',
              description: 'Upload a file to OneDrive root folder.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileName: {
                    type: 'string',
                    description: 'The name for the file',
                  },
                  content: {
                    type: 'string',
                    description: 'The file content',
                  },
                },
                required: ['fileName', 'content'],
              },
            },
            {
              name: 'delete_file',
              description: 'Delete a file from OneDrive by file ID.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID',
                  },
                },
                required: ['fileId'],
              },
            },
            {
              name: 'download_url',
              description: 'Get a temporary download URL for a file (expires in 1 hour).',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID',
                  },
                },
                required: ['fileId'],
              },
            },
            {
              name: 'get_folder',
              description: 'Get folder metadata including folder ID by providing a folder path. Returns folder ID, name, path, and URLs.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderPath: {
                    type: 'string',
                    description: 'The folder path (e.g., "Wippli_Master_Microsoft/Wippli_Consulting/Wippli_ProLogistiks/proLogistik_Wippli_Tasks")',
                  },
                },
                required: ['folderPath'],
              },
            },
            {
              name: 'list_folder_contents',
              description: 'List all files and folders within a folder. Returns names, IDs, types, sizes, and modification dates.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderPath: {
                    type: 'string',
                    description: 'The folder path (e.g., "Wippli_Master_Microsoft/Wippli_Consulting/Wippli_ProLogistiks")',
                  },
                },
                required: ['folderPath'],
              },
            },
          ],
        };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;
        const userId = args?.userId || 'default-user';

        switch (name) {
          case 'list_files':
            result = await listFiles(userId);
            break;
          case 'read_file':
            result = await readFile(args.fileId, userId);
            break;
          case 'upload_file':
            result = await uploadFile(args.fileName, args.content, userId);
            break;
          case 'delete_file':
            result = await deleteFile(args.fileId, userId);
            break;
          case 'download_url':
            result = await getDownloadUrl(args.fileId, userId);
            break;
          case 'get_folder':
            result = await getFolder(args.folderPath, userId);
            break;
          case 'list_folder_contents':
            result = await listFolderContents(args.folderPath, userId);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // Wrap result in MCP content format
        result = {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    res.status(200).json({
      jsonrpc: '2.0',
      result,
      id,
    });
  } catch (error: any) {
    console.error('OneDrive MCP error:', error);
    res.status(200).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
      id,
    });
  }
}
