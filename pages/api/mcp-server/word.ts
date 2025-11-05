import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import Anthropic from '@anthropic-ai/sdk';
import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  TableOfContents,
  UnderlineType,
  ExternalHyperlink
} from 'docx';
import { TableClient } from '@azure/data-tables';

/**
 * Word MCP Server - Pure TypeScript Implementation
 *
 * Following n8n MCP pattern - no child processes, clean JSON-RPC 2.0
 *
 * COMPREHENSIVE 24-TOOL SUITE:
 *
 * DOCUMENT MANAGEMENT:
 * 1. create_document - Create new Word documents
 * 2. read_document - Read and extract Word document content
 * 3. list_documents - List available .docx files
 * 4. delete_document - Delete documents from blob storage
 * 5. get_document_url - Get temporary download URLs (1 hour expiry)
 * 6. copy_document - Copy/duplicate a document
 *
 * TEMPLATE MANAGEMENT:
 * 7. upload_template - Upload a Word template to blob storage
 * 8. list_templates - List all available templates
 * 9. create_from_template - Create document from template with variable substitution
 * 10. delete_template - Delete a template from storage
 *
 * CONTENT EDITING:
 * 11. add_paragraph - Add paragraphs with various formatting
 * 12. add_heading - Add headings (H1-H6)
 * 13. add_list - Add bulleted or numbered lists
 * 14. add_table - Create and populate tables
 * 15. update_field - Find and replace specific text
 * 16. insert_page_break - Insert page breaks
 *
 * FORMATTING:
 * 17. format_text - Apply bold, italic, underline, color formatting to text
 * 18. set_paragraph_alignment - Set alignment (left, center, right, justify)
 *
 * ADVANCED FEATURES:
 * 19. add_image - Insert images from URLs or blob storage
 * 20. add_hyperlink - Add clickable hyperlinks
 * 21. add_table_of_contents - Insert table of contents
 * 22. merge_documents - Combine multiple documents
 *
 * AI-POWERED:
 * 23. analyze_questionnaire - AI-powered questionnaire analysis (uses configured model from /config)
 * 24. extract_data - AI-powered data extraction from documents
 */

// Initialize clients (lazy loaded)
let blobServiceClient: BlobServiceClient | null = null;
let anthropicClient: Anthropic | null = null;

function getBlobClient() {
  if (!blobServiceClient) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable not set');
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// Fetch PowerNode configuration to get the selected AI model
async function getPowerNodeConfig(): Promise<{ model: string; apiKey: string } | null> {
  try {
    const connectionString = process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      console.error('No storage connection for config');
      return null;
    }

    const tableClient = TableClient.fromConnectionString(connectionString, 'powernodeconfig');
    const entity = await tableClient.getEntity('default-user', 'config');

    // Parse providers JSON
    const providers = entity.providers ? JSON.parse(entity.providers as string) : {};
    const defaultProvider = entity.defaultProvider as string || 'anthropic';

    // Get the selected provider's config
    const providerConfig = providers[defaultProvider];
    if (!providerConfig || !providerConfig.enabled) {
      console.error(`Provider ${defaultProvider} not enabled`);
      return null;
    }

    return {
      model: providerConfig.model,
      apiKey: providerConfig.apiKey
    };
  } catch (error) {
    console.error('Error fetching PowerNode config:', error);
    return null;
  }
}

// Helper function to convert stream to buffer
async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

// OneDrive integration helpers
const ONEDRIVE_TABLE_NAME = 'powernodeOneDriveConfig';

async function refreshOneDriveToken(clientId: string, clientSecret: string, refreshToken: string, tenantId: string) {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite offline_access User.Read',
    }),
  });

  if (!response.ok) {
    throw new Error(`OneDrive token refresh failed: ${response.statusText}`);
  }

  return await response.json();
}

async function getOneDriveAccessToken(userId: string = 'default-user'): Promise<string> {
  const connectionString = process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Storage connection not configured for OneDrive');
  }

  const tableClient = TableClient.fromConnectionString(connectionString, ONEDRIVE_TABLE_NAME);
  const entity = await tableClient.getEntity(userId, 'onedrive-config');

  let accessToken = entity.accessToken as string;
  const refreshToken = entity.refreshToken as string;
  const expiresAt = entity.expiresAt as string;
  const clientId = entity.clientId as string;
  const clientSecret = entity.clientSecret as string;
  const tenantId = entity.tenantId as string;

  // Refresh token if expired
  if (new Date(expiresAt) <= new Date()) {
    console.log('OneDrive access token expired, refreshing...');
    const tokenData = await refreshOneDriveToken(clientId, clientSecret, refreshToken, tenantId);
    accessToken = tokenData.access_token;

    // Update stored token
    await tableClient.updateEntity({
      partitionKey: entity.partitionKey as string,
      rowKey: entity.rowKey as string,
      accessToken,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      clientId,
      clientSecret,
      tenantId,
      scopes: entity.scopes as string,
    }, 'Merge');
  }

  return accessToken;
}

async function downloadFromOneDrive(fileIdOrFilename: string, userId: string = 'default-user'): Promise<Buffer> {
  const accessToken = await getOneDriveAccessToken(userId);

  // Try as file ID first, then try searching by filename
  let downloadUrl: string;

  try {
    // Get file metadata with download URL
    const metadataResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileIdOrFilename}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      downloadUrl = metadata['@microsoft.graph.downloadUrl'];
    } else {
      // If not found by ID, try searching by filename
      const searchResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${encodeURIComponent(fileIdOrFilename)}'`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!searchResponse.ok) {
        throw new Error(`OneDrive file not found: ${fileIdOrFilename}`);
      }

      const searchData = await searchResponse.json();
      if (searchData.value && searchData.value.length > 0) {
        downloadUrl = searchData.value[0]['@microsoft.graph.downloadUrl'];
      } else {
        throw new Error(`OneDrive file not found: ${fileIdOrFilename}`);
      }
    }
  } catch (error: any) {
    throw new Error(`Failed to get OneDrive file metadata: ${error.message}`);
  }

  if (!downloadUrl) {
    throw new Error('No download URL available for this OneDrive file');
  }

  // Download file content
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download OneDrive file: ${downloadResponse.statusText}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function listOneDriveDocuments(userId: string = 'default-user'): Promise<any[]> {
  try {
    const accessToken = await getOneDriveAccessToken(userId);

    // List files from OneDrive root
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list OneDrive files: ${response.statusText}`);
    }

    const data = await response.json();
    const docxFiles = data.value
      .filter((item: any) => item.name && item.name.endsWith('.docx'))
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModified: item.lastModifiedDateTime,
        source: 'OneDrive'
      }));

    return docxFiles;
  } catch (error: any) {
    console.log(`Failed to list OneDrive documents: ${error.message}`);
    return [];
  }
}

async function uploadToOneDrive(filename: string, buffer: Buffer, userId: string = 'default-user'): Promise<any> {
  const accessToken = await getOneDriveAccessToken(userId);

  // Upload or replace file in OneDrive root
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(filename)}:/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: buffer as any,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to OneDrive: ${response.statusText}. ${errorText}`);
  }

  return await response.json();
}

async function updateOneDrive(fileIdOrFilename: string, buffer: Buffer, userId: string = 'default-user'): Promise<any> {
  const accessToken = await getOneDriveAccessToken(userId);

  // Try to get file ID first if filename was provided
  let fileId = fileIdOrFilename;

  // Check if it's a filename (contains .docx) vs an ID
  if (fileIdOrFilename.includes('.docx')) {
    try {
      const searchResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${encodeURIComponent(fileIdOrFilename)}'`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.value && searchData.value.length > 0) {
          fileId = searchData.value[0].id;
        }
      }
    } catch (error: any) {
      console.log(`Could not find file by name, trying to upload: ${error.message}`);
      // If file not found, upload as new file
      return await uploadToOneDrive(fileIdOrFilename, buffer, userId);
    }
  }

  // Update existing file by ID
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      body: buffer as any,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update OneDrive file: ${response.statusText}. ${errorText}`);
  }

  return await response.json();
}

async function deleteFromOneDrive(fileIdOrFilename: string, userId: string = 'default-user'): Promise<boolean> {
  const accessToken = await getOneDriveAccessToken(userId);

  let fileId = fileIdOrFilename;

  // Try to get file ID if filename was provided
  if (fileIdOrFilename.includes('.docx')) {
    try {
      const searchResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${encodeURIComponent(fileIdOrFilename)}'`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.value && searchData.value.length > 0) {
          fileId = searchData.value[0].id;
        } else {
          throw new Error(`File not found in OneDrive: ${fileIdOrFilename}`);
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to find file for deletion: ${error.message}`);
    }
  }

  // Delete file by ID
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete OneDrive file: ${response.statusText}`);
  }

  return true;
}

async function copyInOneDrive(sourceFileIdOrFilename: string, targetFilename: string, userId: string = 'default-user'): Promise<any> {
  const accessToken = await getOneDriveAccessToken(userId);

  let sourceFileId = sourceFileIdOrFilename;

  // Try to get source file ID if filename was provided
  if (sourceFileIdOrFilename.includes('.docx')) {
    const searchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${encodeURIComponent(sourceFileIdOrFilename)}'`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.value && searchData.value.length > 0) {
        sourceFileId = searchData.value[0].id;
      } else {
        throw new Error(`Source file not found in OneDrive: ${sourceFileIdOrFilename}`);
      }
    } else {
      throw new Error(`Failed to search for source file in OneDrive`);
    }
  }

  // Copy file using Microsoft Graph API
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${sourceFileId}/copy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: targetFilename,
      parentReference: {
        path: '/drive/root:'
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to copy OneDrive file: ${response.statusText}. ${errorText}`);
  }

  // Copy operation is async, returns 202 Accepted with a Location header to monitor progress
  // For now, we'll return success immediately
  return { message: `File copy initiated from ${sourceFileIdOrFilename} to ${targetFilename}` };
}

// Tool definitions (MCP protocol)
const TOOLS = [
  // DOCUMENT MANAGEMENT
  {
    name: 'create_document',
    description: 'Create a new Word document with optional title and content',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (without .docx extension)'
        },
        title: {
          type: 'string',
          description: 'Document title (optional)'
        },
        content: {
          type: 'string',
          description: 'Initial content (optional)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'read_document',
    description: 'Read and extract content from a Word document. Supports OneDrive file IDs, OneDrive filenames, or Azure Blob Storage filenames.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file) or OneDrive file ID'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'list_documents',
    description: 'List all .docx Word documents from both OneDrive and Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          description: 'Optional filename prefix filter'
        }
      }
    }
  },
  {
    name: 'delete_document',
    description: 'Delete a Word document from OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file) to delete'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_document_url',
    description: 'Get a temporary download URL for a Word document (valid for 1 hour)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'copy_document',
    description: 'Copy/duplicate a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilename: {
          type: 'string',
          description: 'Source document filename (.docx file)'
        },
        targetFilename: {
          type: 'string',
          description: 'Target document filename (without .docx extension)'
        }
      },
      required: ['sourceFilename', 'targetFilename']
    }
  },

  // TEMPLATE MANAGEMENT
  {
    name: 'upload_template',
    description: 'Upload a Word template to OneDrive or Azure Blob Storage in the templates/ folder',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .docx extension)'
        },
        sourceFilename: {
          type: 'string',
          description: 'Source document filename to use as template'
        }
      },
      required: ['templateName', 'sourceFilename']
    }
  },
  {
    name: 'list_templates',
    description: 'List all available Word templates from OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_from_template',
    description: 'Create a new document from a template in OneDrive or Azure Blob Storage with variable substitution (replaces {{variableName}} placeholders)',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .docx extension)'
        },
        targetFilename: {
          type: 'string',
          description: 'New document filename (without .docx extension)'
        },
        variables: {
          type: 'object',
          description: 'Key-value pairs for template variable substitution (e.g., {"companyName": "Acme Corp", "date": "2025-01-01"})'
        }
      },
      required: ['templateName', 'targetFilename']
    }
  },
  {
    name: 'delete_template',
    description: 'Delete a Word template from OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .docx extension)'
        }
      },
      required: ['templateName']
    }
  },

  // CONTENT EDITING
  {
    name: 'add_paragraph',
    description: 'Add a paragraph to an existing Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        text: {
          type: 'string',
          description: 'Paragraph text to add'
        },
        alignment: {
          type: 'string',
          description: 'Text alignment (left, center, right, justify)',
          enum: ['left', 'center', 'right', 'justify']
        }
      },
      required: ['filename', 'text']
    }
  },
  {
    name: 'add_heading',
    description: 'Add a heading to an existing Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        text: {
          type: 'string',
          description: 'Heading text'
        },
        level: {
          type: 'number',
          description: 'Heading level (1-6, where 1 is largest)',
          minimum: 1,
          maximum: 6
        }
      },
      required: ['filename', 'text', 'level']
    }
  },
  {
    name: 'add_list',
    description: 'Add a bulleted or numbered list to a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of list items'
        },
        type: {
          type: 'string',
          description: 'List type (bullet or number)',
          enum: ['bullet', 'number']
        }
      },
      required: ['filename', 'items', 'type']
    }
  },
  {
    name: 'add_table',
    description: 'Create and add a table to a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        headers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Table header row'
        },
        rows: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' }
          },
          description: 'Table data rows (array of arrays)'
        }
      },
      required: ['filename', 'headers', 'rows']
    }
  },
  {
    name: 'update_field',
    description: 'Find and replace specific text content in a Word document while preserving all formatting (bold, italic, colors, tables, images, etc.) in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        searchText: {
          type: 'string',
          description: 'Text to find in the document'
        },
        replaceText: {
          type: 'string',
          description: 'New text to replace with'
        }
      },
      required: ['filename', 'searchText', 'replaceText']
    }
  },
  {
    name: 'insert_page_break',
    description: 'Insert a page break in a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        }
      },
      required: ['filename']
    }
  },

  // FORMATTING
  {
    name: 'format_text',
    description: 'Add formatted text (bold, italic, underline, color) to a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        text: {
          type: 'string',
          description: 'Text content'
        },
        bold: {
          type: 'boolean',
          description: 'Make text bold'
        },
        italic: {
          type: 'boolean',
          description: 'Make text italic'
        },
        underline: {
          type: 'boolean',
          description: 'Underline text'
        },
        color: {
          type: 'string',
          description: 'Text color in hex format (e.g., "FF0000" for red)'
        }
      },
      required: ['filename', 'text']
    }
  },
  {
    name: 'set_paragraph_alignment',
    description: 'Set alignment for the last paragraph in a document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        alignment: {
          type: 'string',
          description: 'Alignment type',
          enum: ['left', 'center', 'right', 'justify']
        }
      },
      required: ['filename', 'alignment']
    }
  },

  // ADVANCED FEATURES
  {
    name: 'add_image',
    description: 'Insert an image into a Word document in OneDrive or Azure Blob Storage from a URL or blob storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        imageUrl: {
          type: 'string',
          description: 'Image URL or blob storage path'
        },
        width: {
          type: 'number',
          description: 'Image width in pixels (optional, default 600)'
        },
        height: {
          type: 'number',
          description: 'Image height in pixels (optional, default 400)'
        }
      },
      required: ['filename', 'imageUrl']
    }
  },
  {
    name: 'add_hyperlink',
    description: 'Add a clickable hyperlink to a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        text: {
          type: 'string',
          description: 'Link text to display'
        },
        url: {
          type: 'string',
          description: 'Target URL'
        }
      },
      required: ['filename', 'text', 'url']
    }
  },
  {
    name: 'add_table_of_contents',
    description: 'Insert a table of contents in a Word document in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'merge_documents',
    description: 'Merge multiple Word documents into one in OneDrive or Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilenames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of source document filenames (.docx files)'
        },
        targetFilename: {
          type: 'string',
          description: 'Target merged document filename (without .docx extension)'
        }
      },
      required: ['sourceFilenames', 'targetFilename']
    }
  },

  // AI-POWERED
  {
    name: 'analyze_questionnaire',
    description: 'Analyze a Word document using Claude AI to detect questionnaire structure, field types, and metadata',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'extract_data',
    description: 'Use Claude AI to extract specific data or information from a Word document',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Document filename (.docx file)'
        },
        prompt: {
          type: 'string',
          description: 'Instructions for what data to extract (e.g., "Extract all dates and names", "Find action items")'
        }
      },
      required: ['filename', 'prompt']
    }
  }
];

// Tool implementation functions

async function createDocument(args: any): Promise<string> {
  const { filename, title, content } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  const children: any[] = [];

  if (title) {
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1
      })
    );
  }

  if (content) {
    children.push(
      new Paragraph({
        children: [new TextRun(content)]
      })
    );
  }

  // Create document
  const doc = new Document({
    sections: [{
      children: children.length > 0 ? children : [
        new Paragraph({ children: [new TextRun(' ')] })
      ]
    }]
  });

  // Convert to buffer
  const { Packer } = await import('docx');
  const buffer = await Packer.toBuffer(doc);

  // Try OneDrive first for live collaboration
  try {
    await uploadToOneDrive(docFilename, buffer);
    console.log(`Document created in OneDrive: ${docFilename}`);
    return `Document created in OneDrive: ${docFilename}`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive upload failed (${oneDriveError.message}), falling back to Blob Storage...`);

    // Fallback to blob storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    console.log(`Document created in Blob Storage: ${docFilename}`);
    return `Document created in Blob Storage: ${docFilename}`;
  }
}

async function readDocument(args: any): Promise<string> {
  const { filename } = args;
  let buffer: Buffer;
  let source: string;

  // Try OneDrive first (supports both file IDs and filenames)
  try {
    buffer = await downloadFromOneDrive(filename);
    source = 'OneDrive';
    console.log(`Successfully read document from OneDrive: ${filename}`);
  } catch (oneDriveError: any) {
    console.log(`OneDrive read failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    try {
      const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;
      const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
      const blobClient = getBlobClient();
      const containerClient = blobClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

      // Download document
      const downloadResponse = await blockBlobClient.download();
      if (!downloadResponse.readableStreamBody) {
        throw new Error('Failed to download document from Blob Storage');
      }

      buffer = await streamToBuffer(downloadResponse.readableStreamBody);
      source = 'Blob Storage';
      console.log(`Successfully read document from Blob Storage: ${docFilename}`);
    } catch (blobError: any) {
      throw new Error(`Document not found in OneDrive or Blob Storage: ${filename}. OneDrive error: ${oneDriveError.message}. Blob error: ${blobError.message}`);
    }
  }

  // Parse with mammoth
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });

  return JSON.stringify({
    filename,
    source,
    text: result.value,
    length: result.value.length
  }, null, 2);
}

async function listDocuments(args: any): Promise<string> {
  const { prefix } = args;
  const documents: any[] = [];

  // Get OneDrive documents
  try {
    const oneDriveDocs = await listOneDriveDocuments();
    documents.push(...oneDriveDocs);
  } catch (error: any) {
    console.log(`Failed to list OneDrive documents: ${error.message}`);
  }

  // Get Blob Storage documents
  try {
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      if (blob.name.endsWith('.docx')) {
        documents.push({
          name: blob.name,
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified,
          source: 'Blob Storage'
        });
      }
    }
  } catch (error: any) {
    console.log(`Failed to list Blob Storage documents: ${error.message}`);
  }

  // Apply prefix filter if specified
  const filteredDocs = prefix
    ? documents.filter(doc => doc.name.startsWith(prefix))
    : documents;

  return JSON.stringify(filteredDocs, null, 2);
}

async function deleteDocument(args: any): Promise<string> {
  const { filename } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    await deleteFromOneDrive(docFilename);
    return `Document deleted from OneDrive: ${docFilename}`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive delete failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Check if exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      throw new Error(`Document ${docFilename} not found in OneDrive or Blob Storage`);
    }

    // Delete
    await blockBlobClient.delete();

    return `Document deleted from Blob Storage: ${docFilename}`;
  }
}

async function getDocumentUrl(args: any): Promise<string> {
  const { filename } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

  // Check if exists
  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Document ${docFilename} not found`);
  }

  // Generate SAS token (valid for 1 hour)
  const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = await import('@azure/storage-blob');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  }

  // Parse connection string to get account name and key
  const parts = connectionString.split(';');
  const accountName = parts.find(p => p.startsWith('AccountName='))?.split('=')[1] || '';
  const accountKey = parts.find(p => p.startsWith('AccountKey='))?.split('=')[1] || '';

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName: docFilename,
    permissions: BlobSASPermissions.parse('r'), // read-only
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
  }, sharedKeyCredential).toString();

  const url = `${blockBlobClient.url}?${sasToken}`;

  return JSON.stringify({
    filename: docFilename,
    url,
    expiresIn: '1 hour'
  }, null, 2);
}

async function copyDocument(args: any): Promise<string> {
  const { sourceFilename, targetFilename } = args;
  const sourceDocFilename = sourceFilename.endsWith('.docx') ? sourceFilename : `${sourceFilename}.docx`;
  const targetDocFilename = targetFilename.endsWith('.docx') ? targetFilename : `${targetFilename}.docx`;

  // Try OneDrive first
  try {
    await copyInOneDrive(sourceDocFilename, targetDocFilename);
    return `Document copied in OneDrive: ${sourceDocFilename} to ${targetDocFilename}`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive copy failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    const sourceBlobClient = containerClient.getBlockBlobClient(sourceDocFilename);
    const targetBlobClient = containerClient.getBlockBlobClient(targetDocFilename);

    // Check if source exists
    const exists = await sourceBlobClient.exists();
    if (!exists) {
      throw new Error(`Source document ${sourceDocFilename} not found in OneDrive or Blob Storage`);
    }

    // Copy blob
    await targetBlobClient.beginCopyFromURL(sourceBlobClient.url);

    return `Document copied in Blob Storage: ${sourceDocFilename} to ${targetDocFilename}`;
  }
}

// TEMPLATE FUNCTIONS

async function uploadTemplate(args: any): Promise<string> {
  const { templateName, sourceFilename } = args;
  const sourceDocFilename = sourceFilename.endsWith('.docx') ? sourceFilename : `${sourceFilename}.docx`;
  const templateDocFilename = templateName.endsWith('.docx') ? templateName : `${templateName}.docx`;

  // Try OneDrive first
  try {
    // Download source from OneDrive
    const buffer = await downloadFromOneDrive(sourceDocFilename);
    // Upload as template (templates/ prefix)
    await uploadToOneDrive(`templates/${templateDocFilename}`, buffer);
    return `Template uploaded to OneDrive: templates/${templateDocFilename}`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive template upload failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    const sourceBlobClient = containerClient.getBlockBlobClient(sourceDocFilename);
    const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateDocFilename}`);

    // Check if source exists
    const exists = await sourceBlobClient.exists();
    if (!exists) {
      throw new Error(`Source document ${sourceDocFilename} not found in OneDrive or Blob Storage`);
    }

    // Copy to templates folder
    await templateBlobClient.beginCopyFromURL(sourceBlobClient.url);

    return `Template uploaded to Blob Storage: templates/${templateDocFilename}`;
  }
}

async function listTemplates(args: any): Promise<string> {
  const templates: any[] = [];

  // Try OneDrive first
  try {
    const accessToken = await getOneDriveAccessToken();
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      const oneDriveTemplates = data.value
        .filter((item: any) => item.name && item.name.startsWith('templates/') && item.name.endsWith('.docx'))
        .map((item: any) => ({
          name: item.name.replace('templates/', ''),
          size: item.size,
          lastModified: item.lastModifiedDateTime,
          source: 'OneDrive'
        }));
      templates.push(...oneDriveTemplates);
    }
  } catch (error: any) {
    console.log(`Failed to list OneDrive templates: ${error.message}`);
  }

  // Also get Blob Storage templates
  try {
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    for await (const blob of containerClient.listBlobsFlat({ prefix: 'templates/' })) {
      if (blob.name.endsWith('.docx')) {
        templates.push({
          name: blob.name.replace('templates/', ''),
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified,
          source: 'Blob Storage'
        });
      }
    }
  } catch (error: any) {
    console.log(`Failed to list Blob Storage templates: ${error.message}`);
  }

  return JSON.stringify(templates, null, 2);
}

async function createFromTemplate(args: any): Promise<string> {
  const { templateName, targetFilename, variables } = args;
  const templateDocFilename = templateName.endsWith('.docx') ? templateName : `${templateName}.docx`;
  const targetDocFilename = targetFilename.endsWith('.docx') ? targetFilename : `${targetFilename}.docx`;

  let buffer: Buffer;
  let source: string;

  // Try OneDrive first
  try {
    buffer = await downloadFromOneDrive(`templates/${templateDocFilename}`);
    source = 'OneDrive';
  } catch (oneDriveError: any) {
    console.log(`OneDrive template download failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateDocFilename}`);
    const exists = await templateBlobClient.exists();
    if (!exists) {
      throw new Error(`Template ${templateDocFilename} not found in OneDrive or Blob Storage templates/ folder`);
    }

    const downloadResponse = await templateBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download template from Blob Storage');
    }

    buffer = await streamToBuffer(downloadResponse.readableStreamBody);
    source = 'Blob Storage';
  }

  // Parse template with mammoth
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  let docText = result.value;

  // Replace variables if provided
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      docText = docText.replace(new RegExp(placeholder, 'g'), value as string);
    }
  }

  // Create new document from template
  const doc = new Document({
    sections: [{
      children: docText.split('\n').map(line =>
        new Paragraph({ children: [new TextRun(line || ' ')] })
      )
    }]
  });

  // Convert and upload
  const { Packer } = await import('docx');
  const newBuffer = await Packer.toBuffer(doc);

  // Try to upload to OneDrive first
  try {
    await uploadToOneDrive(targetDocFilename, newBuffer);
    return `Document created from template (${source}) and uploaded to OneDrive: ${targetDocFilename}${variables ? ' with variable substitution' : ''}`;
  } catch (uploadError: any) {
    console.log(`OneDrive upload failed, trying Blob Storage...`);

    // Fallback to Blob Storage upload
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const targetBlobClient = containerClient.getBlockBlobClient(targetDocFilename);

    await targetBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Document created from template (${source}) and uploaded to Blob Storage: ${targetDocFilename}${variables ? ' with variable substitution' : ''}`;
  }
}

async function deleteTemplate(args: any): Promise<string> {
  const { templateName } = args;
  const templateDocFilename = templateName.endsWith('.docx') ? templateName : `${templateName}.docx`;

  // Try OneDrive first
  try {
    await deleteFromOneDrive(`templates/${templateDocFilename}`);
    return `Template deleted from OneDrive: templates/${templateDocFilename}`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive template delete failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateDocFilename}`);

    // Check if exists
    const exists = await templateBlobClient.exists();
    if (!exists) {
      throw new Error(`Template ${templateDocFilename} not found in OneDrive or Blob Storage templates/ folder`);
    }

    // Delete
    await templateBlobClient.delete();

    return `Template deleted from Blob Storage: templates/${templateDocFilename}`;
  }
}

async function addParagraph(args: any): Promise<string> {
  const { filename, text, alignment } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + new paragraph
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add new paragraph with alignment
    const alignmentMap: any = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED
    };

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(text)],
        alignment: alignment ? alignmentMap[alignment] : AlignmentType.LEFT
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added paragraph to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + new paragraph
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add new paragraph with alignment
    const alignmentMap: any = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED
    };

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(text)],
        alignment: alignment ? alignmentMap[alignment] : AlignmentType.LEFT
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added paragraph to ${docFilename} in Blob Storage`;
  }
}

async function addHeading(args: any): Promise<string> {
  const { filename, text, level } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + new heading
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add new heading
    const headingLevels: any = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6
    };

    paragraphs.push(
      new Paragraph({
        text,
        heading: headingLevels[level] || HeadingLevel.HEADING_1
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added heading level ${level} to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + new heading
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add new heading
    const headingLevels: any = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
      4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5,
      6: HeadingLevel.HEADING_6
    };

    paragraphs.push(
      new Paragraph({
        text,
        heading: headingLevels[level] || HeadingLevel.HEADING_1
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added heading level ${level} to ${docFilename} in Blob Storage`;
  }
}

async function addList(args: any): Promise<string> {
  const { filename, items, type } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + list
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add list items
    const bulletChar = type === 'bullet' ? '• ' : '';
    items.forEach((item: string, index: number) => {
      const prefix = type === 'number' ? `${index + 1}. ` : bulletChar;
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(`${prefix}${item}`)]
        })
      );
    });

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added ${type} list with ${items.length} items to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with existing text + list
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add list items
    const bulletChar = type === 'bullet' ? '• ' : '';
    items.forEach((item: string, index: number) => {
      const prefix = type === 'number' ? `${index + 1}. ` : bulletChar;
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(`${prefix}${item}`)]
        })
      );
    });

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added ${type} list with ${items.length} items to ${docFilename} in Blob Storage`;
  }
}

async function addTable(args: any): Promise<string> {
  const { filename, headers, rows } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create paragraphs from existing text
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Create table
    const tableRows = [
      // Header row
      new TableRow({
        children: headers.map((header: string) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
            width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
          })
        )
      }),
      // Data rows
      ...rows.map((row: string[]) =>
        new TableRow({
          children: row.map((cell: string) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(cell)] })],
              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
            })
          )
        })
      )
    ];

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    });

    const doc = new Document({
      sections: [{
        children: [...paragraphs, table]
      }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added table with ${headers.length} columns and ${rows.length} rows to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create paragraphs from existing text
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Create table
    const tableRows = [
      // Header row
      new TableRow({
        children: headers.map((header: string) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
            width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
          })
        )
      }),
      // Data rows
      ...rows.map((row: string[]) =>
        new TableRow({
          children: row.map((cell: string) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(cell)] })],
              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE }
            })
          )
        })
      )
    ];

    const table = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE }
    });

    const doc = new Document({
      sections: [{
        children: [...paragraphs, table]
      }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added table with ${headers.length} columns and ${rows.length} rows to ${docFilename} in Blob Storage`;
  }
}

async function updateField(args: any): Promise<string> {
  const { filename, searchText, replaceText } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Helper function to escape regex special characters
  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Helper function to replace text in XML while preserving formatting
  function replaceTextInXml(xml: string, search: string, replace: string): string {
    // Escape search text for regex
    const escapedSearch = escapeRegex(search);

    // Replace text content between XML tags while preserving the tags
    // This regex matches text content between > and < that contains our search string
    const regex = new RegExp(`>([^<]*)(${escapedSearch})([^<]*)<`, 'g');
    return xml.replace(regex, (match, before, searchMatch, after) => {
      return `>${before}${replace}${after}<`;
    });
  }

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Use pizzip to load .docx as a ZIP archive
    const PizZip = (await import('pizzip')).default;
    const zip = new PizZip(buffer);

    // Get document.xml
    const documentXml = zip.file('word/document.xml')?.asText();
    if (!documentXml) {
      throw new Error('Could not extract document.xml from .docx file');
    }

    // Check if search text exists
    if (!documentXml.includes(searchText)) {
      throw new Error(`Text "${searchText}" not found in document`);
    }

    // Replace text in XML while preserving all formatting
    const updatedXml = replaceTextInXml(documentXml, searchText, replaceText);

    // Update the ZIP with modified XML
    zip.file('word/document.xml', updatedXml);

    // Generate new buffer
    const newBuffer = Buffer.from(zip.generate({ type: 'nodebuffer' }));

    await updateOneDrive(docFilename, newBuffer);
    console.log(`Updated "${searchText}" to "${replaceText}" in ${docFilename} in OneDrive (formatting preserved)`);
    return `Updated "${searchText}" to "${replaceText}" in ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Use pizzip to load .docx as a ZIP archive
    const PizZip = (await import('pizzip')).default;
    const zip = new PizZip(buffer);

    // Get document.xml
    const documentXml = zip.file('word/document.xml')?.asText();
    if (!documentXml) {
      throw new Error('Could not extract document.xml from .docx file');
    }

    // Check if search text exists
    if (!documentXml.includes(searchText)) {
      throw new Error(`Text "${searchText}" not found in document`);
    }

    // Replace text in XML while preserving all formatting
    const updatedXml = replaceTextInXml(documentXml, searchText, replaceText);

    // Update the ZIP with modified XML
    zip.file('word/document.xml', updatedXml);

    // Generate new buffer
    const newBuffer = Buffer.from(zip.generate({ type: 'nodebuffer' }));

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    console.log(`Updated "${searchText}" to "${replaceText}" in ${docFilename} in Blob Storage (formatting preserved)`);
    return `Updated "${searchText}" to "${replaceText}" in ${docFilename} in Blob Storage`;
  }
}

async function insertPageBreak(args: any): Promise<string> {
  const { filename } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with page break
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    paragraphs.push(
      new Paragraph({
        children: [new PageBreak()]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Inserted page break in ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with page break
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    paragraphs.push(
      new Paragraph({
        children: [new PageBreak()]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Inserted page break in ${docFilename} in Blob Storage`;
  }
}

async function formatText(args: any): Promise<string> {
  const { filename, text, bold, italic, underline, color } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add formatted text
    const textRunOptions: any = {
      text,
      bold: bold || false,
      italics: italic || false
    };

    if (underline) {
      textRunOptions.underline = { type: UnderlineType.SINGLE };
    }

    if (color) {
      textRunOptions.color = color;
    }

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(textRunOptions)]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added formatted text to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add formatted text
    const textRunOptions: any = {
      text,
      bold: bold || false,
      italics: italic || false
    };

    if (underline) {
      textRunOptions.underline = { type: UnderlineType.SINGLE };
    }

    if (color) {
      textRunOptions.color = color;
    }

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(textRunOptions)]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added formatted text to ${docFilename} in Blob Storage`;
  }
}

async function setParagraphAlignment(args: any): Promise<string> {
  const { filename, alignment } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Alignment map
    const alignmentMap: any = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED
    };

    const alignmentType = alignmentMap[alignment] || AlignmentType.LEFT;

    // Create new document with all paragraphs aligned (this sets alignment for the last paragraph as mentioned in tool description)
    const lines = existingText.split('\n');
    const paragraphs = lines.map((line, index) =>
      new Paragraph({
        children: [new TextRun(line || ' ')],
        alignment: index === lines.length - 1 ? alignmentType : AlignmentType.LEFT
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Set paragraph alignment to ${alignment} in ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Alignment map
    const alignmentMap: any = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED
    };

    const alignmentType = alignmentMap[alignment] || AlignmentType.LEFT;

    // Create new document with all paragraphs aligned (this sets alignment for the last paragraph as mentioned in tool description)
    const lines = existingText.split('\n');
    const paragraphs = lines.map((line, index) =>
      new Paragraph({
        children: [new TextRun(line || ' ')],
        alignment: index === lines.length - 1 ? alignmentType : AlignmentType.LEFT
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Set paragraph alignment to ${alignment} in ${docFilename} in Blob Storage`;
  }
}

async function addImage(args: any): Promise<string> {
  const { filename, imageUrl, width, height } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Download image
  const fetch = (await import('node-fetch')).default;
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add image
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: width || 600,
              height: height || 400
            },
            type: 'png' // Specify image type
          } as any) // Type assertion for compatibility
        ]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added image to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add image
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: width || 600,
              height: height || 400
            },
            type: 'png' // Specify image type
          } as any) // Type assertion for compatibility
        ]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added image to ${docFilename} in Blob Storage`;
  }
}

async function addHyperlink(args: any): Promise<string> {
  const { filename, text, url } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add hyperlink (simplified - docx library has more complex hyperlink handling)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: text,
            color: '0000FF',
            underline: { type: UnderlineType.SINGLE }
          }),
          new TextRun(` (${url})`)
        ]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added hyperlink "${text}" to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document
    const paragraphs = existingText.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line || ' ')] })
    );

    // Add hyperlink (simplified - docx library has more complex hyperlink handling)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: text,
            color: '0000FF',
            underline: { type: UnderlineType.SINGLE }
          }),
          new TextRun(` (${url})`)
        ]
      })
    );

    const doc = new Document({
      sections: [{ children: paragraphs }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added hyperlink "${text}" to ${docFilename} in Blob Storage`;
  }
}

async function addTableOfContents(args: any): Promise<string> {
  const { filename } = args;
  const docFilename = filename.endsWith('.docx') ? filename : `${filename}.docx`;

  // Try OneDrive first
  try {
    const buffer = await downloadFromOneDrive(docFilename);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with TOC
    const children: any[] = [
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1
      }),
      new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: '1-5'
      })
    ];

    // Add existing content
    existingText.split('\n').forEach(line => {
      children.push(new Paragraph({ children: [new TextRun(line || ' ')] }));
    });

    const doc = new Document({
      sections: [{ children }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await updateOneDrive(docFilename, newBuffer);
    return `Added table of contents to ${docFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(docFilename);

    // Download existing document
    const downloadResponse = await blockBlobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download document from Blob Storage');
    }

    const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

    // Parse existing document text
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const existingText = result.value;

    // Create new document with TOC
    const children: any[] = [
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1
      }),
      new TableOfContents('Table of Contents', {
        hyperlink: true,
        headingStyleRange: '1-5'
      })
    ];

    // Add existing content
    existingText.split('\n').forEach(line => {
      children.push(new Paragraph({ children: [new TextRun(line || ' ')] }));
    });

    const doc = new Document({
      sections: [{ children }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await blockBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Added table of contents to ${docFilename} in Blob Storage`;
  }
}

async function mergeDocuments(args: any): Promise<string> {
  const { sourceFilenames, targetFilename } = args;
  const targetDocFilename = targetFilename.endsWith('.docx') ? targetFilename : `${targetFilename}.docx`;

  let mergedText = '';

  // Try OneDrive first for all source documents
  try {
    // Download and extract text from each source document
    for (const sourceFilename of sourceFilenames) {
      const sourceDocFilename = sourceFilename.endsWith('.docx') ? sourceFilename : `${sourceFilename}.docx`;

      const buffer = await downloadFromOneDrive(sourceDocFilename);
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      mergedText += result.value + '\n\n--- PAGE BREAK ---\n\n';
    }

    // Create merged document
    const doc = new Document({
      sections: [{
        children: mergedText.split('\n').map(line =>
          new Paragraph({ children: [new TextRun(line || ' ')] })
        )
      }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    await uploadToOneDrive(targetDocFilename, newBuffer);
    return `Merged ${sourceFilenames.length} documents into ${targetDocFilename} in OneDrive`;
  } catch (oneDriveError: any) {
    console.log(`OneDrive operation failed (${oneDriveError.message}), trying Blob Storage...`);

    // Fallback to Blob Storage
    const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
    const blobClient = getBlobClient();
    const containerClient = blobClient.getContainerClient(containerName);

    mergedText = '';

    // Download and extract text from each source document
    for (const sourceFilename of sourceFilenames) {
      const sourceDocFilename = sourceFilename.endsWith('.docx') ? sourceFilename : `${sourceFilename}.docx`;
      const sourceBlobClient = containerClient.getBlockBlobClient(sourceDocFilename);

      const exists = await sourceBlobClient.exists();
      if (!exists) {
        throw new Error(`Source document ${sourceDocFilename} not found in OneDrive or Blob Storage`);
      }

      const downloadResponse = await sourceBlobClient.download();
      if (!downloadResponse.readableStreamBody) {
        throw new Error(`Failed to download ${sourceDocFilename} from Blob Storage`);
      }

      const buffer = await streamToBuffer(downloadResponse.readableStreamBody);
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });

      mergedText += result.value + '\n\n--- PAGE BREAK ---\n\n';
    }

    // Create merged document
    const doc = new Document({
      sections: [{
        children: mergedText.split('\n').map(line =>
          new Paragraph({ children: [new TextRun(line || ' ')] })
        )
      }]
    });

    // Convert and upload
    const { Packer } = await import('docx');
    const newBuffer = await Packer.toBuffer(doc);

    const targetBlobClient = containerClient.getBlockBlobClient(targetDocFilename);
    await targetBlobClient.uploadData(newBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    return `Merged ${sourceFilenames.length} documents into ${targetDocFilename} in Blob Storage`;
  }
}

async function analyzeQuestionnaire(args: any): Promise<string> {
  const { filename } = args;

  // First, read the document
  const docContent = await readDocument({ filename });
  const parsedContent = JSON.parse(docContent);

  // Get PowerNode config to use the selected model
  const config = await getPowerNodeConfig();
  if (!config) {
    throw new Error('PowerNode configuration not found. Please configure your AI provider in /config');
  }

  // Use configured Anthropic client with the selected model
  const anthropic = new Anthropic({ apiKey: config.apiKey });

  const response = await anthropic.messages.create({
    model: config.model, // Dynamically use the model from /config (e.g., claude-3-5-haiku-20241022)
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Analyze this Word document and extract questionnaire structure. Return JSON with:
- questions: array of { text, type (text/checkbox/radio/dropdown), options, required }
- sections: array of section names
- metadata: { title, description }

Document content:
${parsedContent.text}`
    }]
  });

  const analysis = response.content[0].type === 'text' ? response.content[0].text : '';

  return JSON.stringify({
    filename,
    analysis,
    analyzedBy: config.model  // Reports actual model used
  }, null, 2);
}

async function extractData(args: any): Promise<string> {
  const { filename, prompt } = args;

  // First, read the document
  const docContent = await readDocument({ filename });
  const parsedContent = JSON.parse(docContent);

  // Get PowerNode config to use the selected model
  const config = await getPowerNodeConfig();
  if (!config) {
    throw new Error('PowerNode configuration not found. Please configure your AI provider in /config');
  }

  // Use configured Anthropic client with the selected model
  const anthropic = new Anthropic({ apiKey: config.apiKey });

  const response = await anthropic.messages.create({
    model: config.model, // Dynamically use the model from /config
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `${prompt}

Document content:
${parsedContent.text}`
    }]
  });

  const extraction = response.content[0].type === 'text' ? response.content[0].text : '';

  return JSON.stringify({
    filename,
    prompt,
    extraction,
    extractedBy: config.model  // Reports actual model used
  }, null, 2);
}

// Main MCP handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { method, params, id } = req.body;

  try {
    switch (method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'word-mcp-server',
              version: '2.0.0'
            }
          }
        });

      case 'tools/list':
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: TOOLS
          }
        });

      case 'tools/call': {
        const { name, arguments: args } = params;

        let result: string;

        switch (name) {
          // Document Management
          case 'create_document':
            result = await createDocument(args);
            break;
          case 'read_document':
            result = await readDocument(args);
            break;
          case 'list_documents':
            result = await listDocuments(args || {});
            break;
          case 'delete_document':
            result = await deleteDocument(args);
            break;
          case 'get_document_url':
            result = await getDocumentUrl(args);
            break;
          case 'copy_document':
            result = await copyDocument(args);
            break;

          // Template Management
          case 'upload_template':
            result = await uploadTemplate(args);
            break;
          case 'list_templates':
            result = await listTemplates(args || {});
            break;
          case 'create_from_template':
            result = await createFromTemplate(args);
            break;
          case 'delete_template':
            result = await deleteTemplate(args);
            break;

          // Content Editing
          case 'add_paragraph':
            result = await addParagraph(args);
            break;
          case 'add_heading':
            result = await addHeading(args);
            break;
          case 'add_list':
            result = await addList(args);
            break;
          case 'add_table':
            result = await addTable(args);
            break;
          case 'update_field':
            result = await updateField(args);
            break;
          case 'insert_page_break':
            result = await insertPageBreak(args);
            break;

          // Formatting
          case 'format_text':
            result = await formatText(args);
            break;
          case 'set_paragraph_alignment':
            result = await setParagraphAlignment(args);
            break;

          // Advanced Features
          case 'add_image':
            result = await addImage(args);
            break;
          case 'add_hyperlink':
            result = await addHyperlink(args);
            break;
          case 'add_table_of_contents':
            result = await addTableOfContents(args);
            break;
          case 'merge_documents':
            result = await mergeDocuments(args);
            break;

          // AI-Powered
          case 'analyze_questionnaire':
            result = await analyzeQuestionnaire(args);
            break;
          case 'extract_data':
            result = await extractData(args);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: result
              }
            ]
          }
        });
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error: any) {
    console.error('Word MCP Error:', error);
    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    });
  }
}
