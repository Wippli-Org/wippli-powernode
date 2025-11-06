import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

/**
 * OneDrive MCP Server - Pure TypeScript Implementation
 *
 * Provides MCP tools for OneDrive file operations
 * Uses PowerNode's OneDrive configuration from Azure Table Storage
 *
 * COMPREHENSIVE TOOLS (20 total):
 * File Operations:
 * 1. list_files - List all files in OneDrive root folder
 * 2. read_file - Read file contents from OneDrive
 * 3. upload_file - Upload a file to OneDrive root
 * 4. upload_file_to_folder - Upload file to specific folder
 * 5. delete_file - Delete a file from OneDrive
 * 6. copy_file - Copy file to another location
 * 7. move_file - Move file to another location
 * 8. rename_file - Rename a file
 * 9. get_file_by_path - Get file info by path
 * 10. download_url - Get temporary download URL for a file
 * 11. search_files - Search for files by name
 *
 * Folder Operations:
 * 12. get_folder - Get folder metadata by path
 * 13. list_folder_contents - List files and folders within a folder
 * 14. create_folder - Create new folder
 * 15. copy_folder - Copy folder to another location
 * 16. move_folder - Move folder to another location
 * 17. rename_folder - Rename a folder
 * 18. delete_folder - Delete a folder
 *
 * Sharing & Permissions:
 * 19. create_sharing_link - Create shareable link for file/folder
 * 20. get_sharing_permissions - Get current sharing permissions
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

// New File Operations
async function copyFile(fileId: string, targetFolderId: string, newName?: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/copy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parentReference: { id: targetFolderId },
      name: newName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to copy file: ${response.statusText}`);
  }

  return { success: true, message: 'File copy initiated (async operation)' };
}

async function moveFile(fileId: string, targetFolderId: string, newName?: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const body: any = {
    parentReference: { id: targetFolderId },
  };
  if (newName) {
    body.name = newName;
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to move file: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}

async function renameFile(fileId: string, newName: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rename file: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}

async function uploadFileToFolder(folderId: string, fileName: string, content: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}:/${fileName}:/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: content,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload file to folder: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    size: data.size,
    webUrl: data.webUrl,
  };
}

async function getFileByPath(filePath: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const normalizedPath = filePath.replace(/^\/+|\/+$/g, '');
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
    throw new Error(`Failed to get file by path: ${response.statusText}`);
  }

  const fileInfo = await response.json();
  return {
    id: fileInfo.id,
    name: fileInfo.name,
    size: fileInfo.size,
    modifiedAt: fileInfo.lastModifiedDateTime,
    webUrl: fileInfo.webUrl,
    downloadUrl: fileInfo['@microsoft.graph.downloadUrl'],
  };
}

async function searchFiles(query: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(query)}')`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search files: ${response.statusText}`);
  }

  const data = await response.json();
  const results = data.value.map((item: any) => ({
    id: item.id,
    name: item.name,
    type: item.folder ? 'folder' : 'file',
    size: item.size,
    modifiedAt: item.lastModifiedDateTime,
    webUrl: item.webUrl,
    path: item.parentReference?.path,
  }));

  return { results };
}

// New Folder Operations
async function createFolder(folderName: string, parentFolderId?: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const endpoint = parentFolderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`
    : 'https://graph.microsoft.com/v1.0/me/drive/root/children';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
    createdDateTime: data.createdDateTime,
  };
}

async function copyFolder(folderId: string, targetFolderId: string, newName?: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/copy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parentReference: { id: targetFolderId },
      name: newName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to copy folder: ${response.statusText}`);
  }

  return { success: true, message: 'Folder copy initiated (async operation)' };
}

async function moveFolder(folderId: string, targetFolderId: string, newName?: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const body: any = {
    parentReference: { id: targetFolderId },
  };
  if (newName) {
    body.name = newName;
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to move folder: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}

async function renameFolder(folderId: string, newName: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rename folder: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    webUrl: data.webUrl,
  };
}

async function deleteFolder(folderId: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.statusText}`);
  }

  return { success: true };
}

// Sharing & Permissions Operations
async function createSharingLink(itemId: string, linkType: 'view' | 'edit' | 'embed' = 'view', userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: linkType,
      scope: 'anonymous',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create sharing link: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    link: data.link.webUrl,
    type: data.link.type,
    scope: data.link.scope,
  };
}

async function getSharingPermissions(itemId: string, userId?: string) {
  const { accessToken } = await getOneDriveConfig(userId);

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/permissions`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get sharing permissions: ${response.statusText}`);
  }

  const data = await response.json();
  const permissions = data.value.map((perm: any) => ({
    id: perm.id,
    roles: perm.roles,
    link: perm.link?.webUrl,
    grantedTo: perm.grantedTo?.user?.displayName,
  }));

  return { permissions };
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
            {
              name: 'copy_file',
              description: 'Copy a file to another folder. The operation is asynchronous.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID to copy',
                  },
                  targetFolderId: {
                    type: 'string',
                    description: 'The destination folder ID',
                  },
                  newName: {
                    type: 'string',
                    description: 'Optional new name for the copied file',
                  },
                },
                required: ['fileId', 'targetFolderId'],
              },
            },
            {
              name: 'move_file',
              description: 'Move a file to another folder.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID to move',
                  },
                  targetFolderId: {
                    type: 'string',
                    description: 'The destination folder ID',
                  },
                  newName: {
                    type: 'string',
                    description: 'Optional new name for the moved file',
                  },
                },
                required: ['fileId', 'targetFolderId'],
              },
            },
            {
              name: 'rename_file',
              description: 'Rename a file in OneDrive.',
              inputSchema: {
                type: 'object',
                properties: {
                  fileId: {
                    type: 'string',
                    description: 'The OneDrive file ID to rename',
                  },
                  newName: {
                    type: 'string',
                    description: 'The new name for the file',
                  },
                },
                required: ['fileId', 'newName'],
              },
            },
            {
              name: 'upload_file_to_folder',
              description: 'Upload a file to a specific folder by folder ID.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderId: {
                    type: 'string',
                    description: 'The target folder ID',
                  },
                  fileName: {
                    type: 'string',
                    description: 'The name for the file',
                  },
                  content: {
                    type: 'string',
                    description: 'The file content',
                  },
                },
                required: ['folderId', 'fileName', 'content'],
              },
            },
            {
              name: 'get_file_by_path',
              description: 'Get file information by providing the file path instead of file ID.',
              inputSchema: {
                type: 'object',
                properties: {
                  filePath: {
                    type: 'string',
                    description: 'The full file path (e.g., "Wippli_Master_Microsoft/document.docx")',
                  },
                },
                required: ['filePath'],
              },
            },
            {
              name: 'search_files',
              description: 'Search for files and folders by name across OneDrive.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query (file or folder name)',
                  },
                },
                required: ['query'],
              },
            },
            {
              name: 'create_folder',
              description: 'Create a new folder in OneDrive. Can be created in root or within another folder.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderName: {
                    type: 'string',
                    description: 'The name for the new folder',
                  },
                  parentFolderId: {
                    type: 'string',
                    description: 'Optional parent folder ID (if not provided, creates in root)',
                  },
                },
                required: ['folderName'],
              },
            },
            {
              name: 'copy_folder',
              description: 'Copy a folder to another location. The operation is asynchronous.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderId: {
                    type: 'string',
                    description: 'The OneDrive folder ID to copy',
                  },
                  targetFolderId: {
                    type: 'string',
                    description: 'The destination folder ID',
                  },
                  newName: {
                    type: 'string',
                    description: 'Optional new name for the copied folder',
                  },
                },
                required: ['folderId', 'targetFolderId'],
              },
            },
            {
              name: 'move_folder',
              description: 'Move a folder to another location.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderId: {
                    type: 'string',
                    description: 'The OneDrive folder ID to move',
                  },
                  targetFolderId: {
                    type: 'string',
                    description: 'The destination folder ID',
                  },
                  newName: {
                    type: 'string',
                    description: 'Optional new name for the moved folder',
                  },
                },
                required: ['folderId', 'targetFolderId'],
              },
            },
            {
              name: 'rename_folder',
              description: 'Rename a folder in OneDrive.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderId: {
                    type: 'string',
                    description: 'The OneDrive folder ID to rename',
                  },
                  newName: {
                    type: 'string',
                    description: 'The new name for the folder',
                  },
                },
                required: ['folderId', 'newName'],
              },
            },
            {
              name: 'delete_folder',
              description: 'Delete a folder from OneDrive.',
              inputSchema: {
                type: 'object',
                properties: {
                  folderId: {
                    type: 'string',
                    description: 'The OneDrive folder ID to delete',
                  },
                },
                required: ['folderId'],
              },
            },
            {
              name: 'create_sharing_link',
              description: 'Create a shareable link for a file or folder. Link can be view-only, editable, or embeddable.',
              inputSchema: {
                type: 'object',
                properties: {
                  itemId: {
                    type: 'string',
                    description: 'The OneDrive item ID (file or folder)',
                  },
                  linkType: {
                    type: 'string',
                    description: 'Type of link: "view", "edit", or "embed"',
                    enum: ['view', 'edit', 'embed'],
                  },
                },
                required: ['itemId'],
              },
            },
            {
              name: 'get_sharing_permissions',
              description: 'Get current sharing permissions for a file or folder.',
              inputSchema: {
                type: 'object',
                properties: {
                  itemId: {
                    type: 'string',
                    description: 'The OneDrive item ID (file or folder)',
                  },
                },
                required: ['itemId'],
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
          case 'copy_file':
            result = await copyFile(args.fileId, args.targetFolderId, args.newName, userId);
            break;
          case 'move_file':
            result = await moveFile(args.fileId, args.targetFolderId, args.newName, userId);
            break;
          case 'rename_file':
            result = await renameFile(args.fileId, args.newName, userId);
            break;
          case 'upload_file_to_folder':
            result = await uploadFileToFolder(args.folderId, args.fileName, args.content, userId);
            break;
          case 'get_file_by_path':
            result = await getFileByPath(args.filePath, userId);
            break;
          case 'search_files':
            result = await searchFiles(args.query, userId);
            break;
          case 'create_folder':
            result = await createFolder(args.folderName, args.parentFolderId, userId);
            break;
          case 'copy_folder':
            result = await copyFolder(args.folderId, args.targetFolderId, args.newName, userId);
            break;
          case 'move_folder':
            result = await moveFolder(args.folderId, args.targetFolderId, args.newName, userId);
            break;
          case 'rename_folder':
            result = await renameFolder(args.folderId, args.newName, userId);
            break;
          case 'delete_folder':
            result = await deleteFolder(args.folderId, userId);
            break;
          case 'create_sharing_link':
            result = await createSharingLink(args.itemId, args.linkType, userId);
            break;
          case 'get_sharing_permissions':
            result = await getSharingPermissions(args.itemId, userId);
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
