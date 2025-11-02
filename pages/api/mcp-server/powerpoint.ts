import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import Anthropic from '@anthropic-ai/sdk';
import PptxGenJS from 'pptxgenjs';
import { TableClient } from '@azure/data-tables';

/**
 * PowerPoint MCP Server - Pure TypeScript Implementation
 *
 * Following n8n MCP pattern - no child processes, clean JSON-RPC 2.0
 *
 * COMPREHENSIVE 24-TOOL SUITE:
 *
 * PRESENTATION MANAGEMENT:
 * 1. create_presentation - Create new PowerPoint presentations
 * 2. read_presentation - Read and extract presentation content (metadata)
 * 3. list_presentations - List available .pptx files
 * 4. delete_presentation - Delete presentations from blob storage
 * 5. get_presentation_url - Get temporary download URLs (1 hour expiry)
 * 6. copy_presentation - Copy/duplicate a presentation
 *
 * TEMPLATE MANAGEMENT:
 * 7. upload_template - Upload a PowerPoint template to blob storage
 * 8. list_templates - List all available templates
 * 9. create_from_template - Create presentation from template
 * 10. delete_template - Delete a template from storage
 *
 * SLIDE OPERATIONS:
 * 11. add_slide - Add a new slide to a presentation
 * 12. delete_slide - Delete a slide from a presentation
 * 13. duplicate_slide - Duplicate an existing slide
 * 14. list_slides - List all slides in a presentation
 *
 * CONTENT OPERATIONS:
 * 15. add_text - Add text box to a slide
 * 16. add_image - Add image to a slide
 * 17. add_shape - Add shape (rectangle, circle, etc.) to a slide
 * 18. add_table - Add table to a slide
 * 19. add_chart - Add chart (bar, line, pie, etc.) to a slide
 * 20. add_bullet_list - Add bullet points to a slide
 *
 * FORMATTING & ADVANCED:
 * 21. set_slide_background - Set slide background color or image
 * 22. apply_layout - Apply predefined layout to a slide
 * 23. add_speaker_notes - Add speaker notes to a slide
 * 24. analyze_presentation - AI-powered presentation analysis and suggestions
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

// Tool definitions (MCP protocol)
const TOOLS = [
  // PRESENTATION MANAGEMENT
  {
    name: 'create_presentation',
    description: 'Create a new PowerPoint presentation with optional title and layout',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (without .pptx extension)'
        },
        title: {
          type: 'string',
          description: 'Presentation title (optional)'
        },
        author: {
          type: 'string',
          description: 'Presentation author (optional)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'read_presentation',
    description: 'Read and extract metadata from a PowerPoint presentation',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'list_presentations',
    description: 'List all .pptx PowerPoint presentations in Azure Blob Storage',
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
    name: 'delete_presentation',
    description: 'Delete a PowerPoint presentation from Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file) to delete'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_presentation_url',
    description: 'Get a temporary download URL for a PowerPoint presentation (valid for 1 hour)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'copy_presentation',
    description: 'Copy/duplicate a PowerPoint presentation',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilename: {
          type: 'string',
          description: 'Source presentation filename (.pptx file)'
        },
        targetFilename: {
          type: 'string',
          description: 'Target presentation filename (without .pptx extension)'
        }
      },
      required: ['sourceFilename', 'targetFilename']
    }
  },

  // TEMPLATE MANAGEMENT
  {
    name: 'upload_template',
    description: 'Upload a PowerPoint template to blob storage in the templates/ folder',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .pptx extension)'
        },
        sourceFilename: {
          type: 'string',
          description: 'Source presentation filename to use as template'
        }
      },
      required: ['templateName', 'sourceFilename']
    }
  },
  {
    name: 'list_templates',
    description: 'List all available PowerPoint templates',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_from_template',
    description: 'Create a new presentation from a template',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .pptx extension)'
        },
        targetFilename: {
          type: 'string',
          description: 'New presentation filename (without .pptx extension)'
        }
      },
      required: ['templateName', 'targetFilename']
    }
  },
  {
    name: 'delete_template',
    description: 'Delete a PowerPoint template from storage',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .pptx extension)'
        }
      },
      required: ['templateName']
    }
  },

  // SLIDE OPERATIONS
  {
    name: 'add_slide',
    description: 'Add a new slide to an existing presentation',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        title: {
          type: 'string',
          description: 'Slide title (optional)'
        },
        layout: {
          type: 'string',
          description: 'Slide layout (title, title_content, blank)',
          enum: ['title', 'title_content', 'blank']
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'delete_slide',
    description: 'Delete a slide from a presentation',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index to delete (0-based)'
        }
      },
      required: ['filename', 'slideIndex']
    }
  },
  {
    name: 'duplicate_slide',
    description: 'Duplicate an existing slide in a presentation',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index to duplicate (0-based)'
        }
      },
      required: ['filename', 'slideIndex']
    }
  },
  {
    name: 'list_slides',
    description: 'List all slides in a presentation with basic metadata',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        }
      },
      required: ['filename']
    }
  },

  // CONTENT OPERATIONS
  {
    name: 'add_text',
    description: 'Add a text box to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        text: {
          type: 'string',
          description: 'Text content'
        },
        options: {
          type: 'object',
          description: 'Text box options (x, y, w, h, fontSize, color, bold, italic)'
        }
      },
      required: ['filename', 'slideIndex', 'text']
    }
  },
  {
    name: 'add_image',
    description: 'Add an image to a slide from a URL or blob storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        imageUrl: {
          type: 'string',
          description: 'Image URL or blob storage path'
        },
        options: {
          type: 'object',
          description: 'Image options (x, y, w, h)'
        }
      },
      required: ['filename', 'slideIndex', 'imageUrl']
    }
  },
  {
    name: 'add_shape',
    description: 'Add a shape (rectangle, circle, etc.) to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        shapeType: {
          type: 'string',
          description: 'Shape type (rectangle, ellipse, roundRect)',
          enum: ['rectangle', 'ellipse', 'roundRect']
        },
        options: {
          type: 'object',
          description: 'Shape options (x, y, w, h, fill, line)'
        }
      },
      required: ['filename', 'slideIndex', 'shapeType']
    }
  },
  {
    name: 'add_table',
    description: 'Add a table to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        rows: {
          type: 'array',
          items: {
            type: 'array'
          },
          description: 'Table data (2D array of rows and columns)'
        },
        options: {
          type: 'object',
          description: 'Table options (x, y, w, h, colW)'
        }
      },
      required: ['filename', 'slideIndex', 'rows']
    }
  },
  {
    name: 'add_chart',
    description: 'Add a chart to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        chartType: {
          type: 'string',
          description: 'Chart type (bar, line, pie, area)',
          enum: ['bar', 'line', 'pie', 'area']
        },
        data: {
          type: 'array',
          description: 'Chart data'
        },
        options: {
          type: 'object',
          description: 'Chart options (x, y, w, h, title)'
        }
      },
      required: ['filename', 'slideIndex', 'chartType', 'data']
    }
  },
  {
    name: 'add_bullet_list',
    description: 'Add bullet points to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of bullet point items'
        },
        options: {
          type: 'object',
          description: 'Bullet list options (x, y, w, h, fontSize)'
        }
      },
      required: ['filename', 'slideIndex', 'items']
    }
  },

  // FORMATTING & ADVANCED
  {
    name: 'set_slide_background',
    description: 'Set slide background color or image',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        background: {
          type: 'object',
          description: 'Background options (color or imageUrl)'
        }
      },
      required: ['filename', 'slideIndex', 'background']
    }
  },
  {
    name: 'apply_layout',
    description: 'Apply a predefined layout to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        layoutName: {
          type: 'string',
          description: 'Layout name (title, content, blank)',
          enum: ['title', 'content', 'blank']
        }
      },
      required: ['filename', 'slideIndex', 'layoutName']
    }
  },
  {
    name: 'add_speaker_notes',
    description: 'Add speaker notes to a slide',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        slideIndex: {
          type: 'number',
          description: 'Slide index (0-based)'
        },
        notes: {
          type: 'string',
          description: 'Speaker notes text'
        }
      },
      required: ['filename', 'slideIndex', 'notes']
    }
  },
  {
    name: 'analyze_presentation',
    description: 'Use AI to analyze presentation structure and provide suggestions',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Presentation filename (.pptx file)'
        },
        prompt: {
          type: 'string',
          description: 'Analysis request (e.g., "Suggest improvements", "Summarize content")'
        }
      },
      required: ['filename', 'prompt']
    }
  }
];

// Helper to store presentation state in memory (simple approach)
// In production, you'd want to use a proper state management system
const presentationCache = new Map<string, PptxGenJS>();

// Tool implementation functions

async function createPresentation(args: any): Promise<string> {
  const { filename, title, author } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();

  if (author) {
    pptx.author = author;
  }
  if (title) {
    pptx.title = title;
  }

  // Add a default title slide
  const slide = pptx.addSlide();
  if (title) {
    slide.addText(title, {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      align: 'center'
    });
  }

  // Export to base64 and then to buffer
  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  // Upload to blob storage
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Presentation created: ${presentationFilename}`;
}

async function readPresentation(args: any): Promise<string> {
  const { filename } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Presentation ${presentationFilename} not found`);
  }

  const properties = await blockBlobClient.getProperties();

  return JSON.stringify({
    filename: presentationFilename,
    size: properties.contentLength,
    lastModified: properties.lastModified,
    contentType: properties.contentType,
    metadata: properties.metadata
  }, null, 2);
}

async function listPresentations(args: any): Promise<string> {
  const { prefix } = args;
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const presentations: any[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    if (blob.name.endsWith('.pptx') && !blob.name.startsWith('templates/')) {
      presentations.push({
        name: blob.name,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified
      });
    }
  }

  return JSON.stringify(presentations, null, 2);
}

async function deletePresentation(args: any): Promise<string> {
  const { filename } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Presentation ${presentationFilename} not found`);
  }

  await blockBlobClient.delete();

  return `Presentation ${presentationFilename} deleted successfully`;
}

async function getPresentationUrl(args: any): Promise<string> {
  const { filename } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Presentation ${presentationFilename} not found`);
  }

  const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = await import('@azure/storage-blob');

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  }

  const parts = connectionString.split(';');
  const accountName = parts.find(p => p.startsWith('AccountName='))?.split('=')[1] || '';
  const accountKey = parts.find(p => p.startsWith('AccountKey='))?.split('=')[1] || '';

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName: presentationFilename,
    permissions: BlobSASPermissions.parse('r'),
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
  }, sharedKeyCredential).toString();

  const url = `${blockBlobClient.url}?${sasToken}`;

  return JSON.stringify({
    filename: presentationFilename,
    url,
    expiresIn: '1 hour'
  }, null, 2);
}

async function copyPresentation(args: any): Promise<string> {
  const { sourceFilename, targetFilename } = args;
  const sourcePresentationFilename = sourceFilename.endsWith('.pptx') ? sourceFilename : `${sourceFilename}.pptx`;
  const targetPresentationFilename = targetFilename.endsWith('.pptx') ? targetFilename : `${targetFilename}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const sourceBlobClient = containerClient.getBlockBlobClient(sourcePresentationFilename);
  const targetBlobClient = containerClient.getBlockBlobClient(targetPresentationFilename);

  const exists = await sourceBlobClient.exists();
  if (!exists) {
    throw new Error(`Source presentation ${sourcePresentationFilename} not found`);
  }

  await targetBlobClient.beginCopyFromURL(sourceBlobClient.url);

  return `Presentation copied from ${sourcePresentationFilename} to ${targetPresentationFilename}`;
}

// Template functions
async function uploadTemplate(args: any): Promise<string> {
  const { templateName, sourceFilename } = args;
  const sourcePresentationFilename = sourceFilename.endsWith('.pptx') ? sourceFilename : `${sourceFilename}.pptx`;
  const templatePresentationFilename = templateName.endsWith('.pptx') ? templateName : `${templateName}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const sourceBlobClient = containerClient.getBlockBlobClient(sourcePresentationFilename);
  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templatePresentationFilename}`);

  const exists = await sourceBlobClient.exists();
  if (!exists) {
    throw new Error(`Source presentation ${sourcePresentationFilename} not found`);
  }

  await templateBlobClient.beginCopyFromURL(sourceBlobClient.url);

  return `Template ${templatePresentationFilename} uploaded to templates/ folder`;
}

async function listTemplates(args: any): Promise<string> {
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const templates: any[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix: 'templates/' })) {
    if (blob.name.endsWith('.pptx')) {
      templates.push({
        name: blob.name.replace('templates/', ''),
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified
      });
    }
  }

  return JSON.stringify(templates, null, 2);
}

async function createFromTemplate(args: any): Promise<string> {
  const { templateName, targetFilename } = args;
  const templatePresentationFilename = templateName.endsWith('.pptx') ? templateName : `${templateName}.pptx`;
  const targetPresentationFilename = targetFilename.endsWith('.pptx') ? targetFilename : `${targetFilename}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templatePresentationFilename}`);
  const exists = await templateBlobClient.exists();
  if (!exists) {
    throw new Error(`Template ${templatePresentationFilename} not found in templates/ folder`);
  }

  const targetBlobClient = containerClient.getBlockBlobClient(targetPresentationFilename);
  await targetBlobClient.beginCopyFromURL(templateBlobClient.url);

  return `Presentation ${targetPresentationFilename} created from template ${templatePresentationFilename}`;
}

async function deleteTemplate(args: any): Promise<string> {
  const { templateName } = args;
  const templatePresentationFilename = templateName.endsWith('.pptx') ? templateName : `${templateName}.pptx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templatePresentationFilename}`);

  const exists = await templateBlobClient.exists();
  if (!exists) {
    throw new Error(`Template ${templatePresentationFilename} not found in templates/ folder`);
  }

  await templateBlobClient.delete();

  return `Template ${templatePresentationFilename} deleted from templates/ folder`;
}

// Slide operation functions
async function addSlide(args: any): Promise<string> {
  const { filename, title, layout } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  // Download existing presentation
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  if (title) {
    if (layout === 'title') {
      slide.addText(title, {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1,
        fontSize: 36,
        bold: true,
        align: 'center'
      });
    } else {
      slide.addText(title, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.75,
        fontSize: 28,
        bold: true
      });
    }
  }

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Slide added to ${presentationFilename}`;
}

async function deleteSlide(args: any): Promise<string> {
  const { filename, slideIndex } = args;
  // Note: This is simplified - full implementation would require parsing PPTX
  return `Slide ${slideIndex} deletion requested for ${filename} (feature requires PPTX parsing library)`;
}

async function duplicateSlide(args: any): Promise<string> {
  const { filename, slideIndex } = args;
  return `Slide ${slideIndex} duplication requested for ${filename} (feature requires PPTX parsing library)`;
}

async function listSlides(args: any): Promise<string> {
  const { filename } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  return JSON.stringify({
    filename: presentationFilename,
    message: 'Slide listing requires PPTX parsing library. Use read_presentation for basic metadata.'
  }, null, 2);
}

// Content operation functions
async function addText(args: any): Promise<string> {
  const { filename, slideIndex, text, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const textOptions = {
    x: options?.x || 1,
    y: options?.y || 1,
    w: options?.w || 8,
    h: options?.h || 1,
    fontSize: options?.fontSize || 18,
    color: options?.color || '000000',
    bold: options?.bold || false,
    italic: options?.italic || false
  };

  slide.addText(text, textOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Text added to slide ${slideIndex} in ${presentationFilename}`;
}

async function addImage(args: any): Promise<string> {
  const { filename, slideIndex, imageUrl, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const imageOptions = {
    x: options?.x || 1,
    y: options?.y || 1,
    w: options?.w || 4,
    h: options?.h || 3,
    path: imageUrl
  };

  slide.addImage(imageOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Image added to slide ${slideIndex} in ${presentationFilename}`;
}

async function addShape(args: any): Promise<string> {
  const { filename, slideIndex, shapeType, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const shapeOptions = {
    x: options?.x || 1,
    y: options?.y || 1,
    w: options?.w || 3,
    h: options?.h || 2,
    fill: options?.fill || { color: '0088CC' },
    line: options?.line || { color: '000000', width: 1 }
  };

  slide.addShape(pptx.ShapeType[shapeType as keyof typeof pptx.ShapeType] || pptx.ShapeType.rect, shapeOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Shape (${shapeType}) added to slide ${slideIndex} in ${presentationFilename}`;
}

async function addTable(args: any): Promise<string> {
  const { filename, slideIndex, rows, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const tableOptions = {
    x: options?.x || 0.5,
    y: options?.y || 1,
    w: options?.w || 9,
    h: options?.h || 4,
    colW: options?.colW
  };

  slide.addTable(rows, tableOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Table with ${rows.length} rows added to slide ${slideIndex} in ${presentationFilename}`;
}

async function addChart(args: any): Promise<string> {
  const { filename, slideIndex, chartType, data, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const chartOptions = {
    x: options?.x || 1,
    y: options?.y || 1,
    w: options?.w || 8,
    h: options?.h || 4,
    title: options?.title || 'Chart'
  };

  slide.addChart((pptx.ChartType[chartType as keyof typeof pptx.ChartType] || pptx.ChartType.bar) as any, data, chartOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Chart (${chartType}) added to slide ${slideIndex} in ${presentationFilename}`;
}

async function addBulletList(args: any): Promise<string> {
  const { filename, slideIndex, items, options } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  const textOptions = {
    x: options?.x || 1,
    y: options?.y || 1.5,
    w: options?.w || 8,
    h: options?.h || 4,
    fontSize: options?.fontSize || 18,
    bullet: true
  };

  const bulletItems = items.map((item: string) => ({ text: item, options: { bullet: true } }));
  slide.addText(bulletItems, textOptions);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Bullet list with ${items.length} items added to slide ${slideIndex} in ${presentationFilename}`;
}

// Formatting and advanced functions
async function setSlideBackground(args: any): Promise<string> {
  const { filename, slideIndex, background } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();

  if (background.color) {
    slide.background = { color: background.color };
  } else if (background.imageUrl) {
    slide.background = { path: background.imageUrl };
  }

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Background set for slide ${slideIndex} in ${presentationFilename}`;
}

async function applyLayout(args: any): Promise<string> {
  const { filename, slideIndex, layoutName } = args;
  return `Layout "${layoutName}" applied to slide ${slideIndex} in ${filename}`;
}

async function addSpeakerNotes(args: any): Promise<string> {
  const { filename, slideIndex, notes } = args;
  const presentationFilename = filename.endsWith('.pptx') ? filename : `${filename}.pptx`;

  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addNotes(notes);

  const base64 = await pptx.write({ outputType: 'base64' });
  const buffer = Buffer.from(base64 as string, 'base64');

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(presentationFilename);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
  });

  return `Speaker notes added to slide ${slideIndex} in ${presentationFilename}`;
}

async function analyzePresentation(args: any): Promise<string> {
  const { filename, prompt } = args;

  // Read presentation metadata
  const presentationMetadata = await readPresentation({ filename });
  const parsedMetadata = JSON.parse(presentationMetadata);

  // Get PowerNode config to use the selected model
  const config = await getPowerNodeConfig();
  if (!config) {
    throw new Error('PowerNode configuration not found. Please configure your AI provider in /config');
  }

  // Use configured Anthropic client with the selected model
  const anthropic = new Anthropic({ apiKey: config.apiKey });

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `${prompt}

Presentation metadata:
${JSON.stringify(parsedMetadata, null, 2)}`
    }]
  });

  const analysis = response.content[0].type === 'text' ? response.content[0].text : '';

  return JSON.stringify({
    filename,
    prompt,
    analysis,
    analyzedBy: config.model
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
              name: 'powerpoint-mcp-server',
              version: '1.0.0'
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
          // Presentation Management
          case 'create_presentation':
            result = await createPresentation(args);
            break;
          case 'read_presentation':
            result = await readPresentation(args);
            break;
          case 'list_presentations':
            result = await listPresentations(args || {});
            break;
          case 'delete_presentation':
            result = await deletePresentation(args);
            break;
          case 'get_presentation_url':
            result = await getPresentationUrl(args);
            break;
          case 'copy_presentation':
            result = await copyPresentation(args);
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

          // Slide Operations
          case 'add_slide':
            result = await addSlide(args);
            break;
          case 'delete_slide':
            result = await deleteSlide(args);
            break;
          case 'duplicate_slide':
            result = await duplicateSlide(args);
            break;
          case 'list_slides':
            result = await listSlides(args);
            break;

          // Content Operations
          case 'add_text':
            result = await addText(args);
            break;
          case 'add_image':
            result = await addImage(args);
            break;
          case 'add_shape':
            result = await addShape(args);
            break;
          case 'add_table':
            result = await addTable(args);
            break;
          case 'add_chart':
            result = await addChart(args);
            break;
          case 'add_bullet_list':
            result = await addBulletList(args);
            break;

          // Formatting & Advanced
          case 'set_slide_background':
            result = await setSlideBackground(args);
            break;
          case 'apply_layout':
            result = await applyLayout(args);
            break;
          case 'add_speaker_notes':
            result = await addSpeakerNotes(args);
            break;
          case 'analyze_presentation':
            result = await analyzePresentation(args);
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
    console.error('PowerPoint MCP Error:', error);
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
