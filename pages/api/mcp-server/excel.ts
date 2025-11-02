import type { NextApiRequest, NextApiResponse } from 'next';
import { BlobServiceClient } from '@azure/storage-blob';
import Anthropic from '@anthropic-ai/sdk';
import ExcelJS from 'exceljs';
import { TableClient } from '@azure/data-tables';

/**
 * Excel MCP Server - Pure TypeScript Implementation
 *
 * Following n8n MCP pattern - no child processes, clean JSON-RPC 2.0
 *
 * COMPREHENSIVE 24-TOOL SUITE:
 *
 * WORKBOOK MANAGEMENT:
 * 1. create_workbook - Create new Excel workbooks
 * 2. read_workbook - Read and extract Excel workbook content
 * 3. list_workbooks - List available .xlsx files
 * 4. delete_workbook - Delete workbooks from blob storage
 * 5. get_workbook_url - Get temporary download URLs (1 hour expiry)
 * 6. copy_workbook - Copy/duplicate a workbook
 *
 * TEMPLATE MANAGEMENT:
 * 7. upload_template - Upload an Excel template to blob storage
 * 8. list_templates - List all available templates
 * 9. create_from_template - Create workbook from template with variable substitution
 * 10. delete_template - Delete a template from storage
 *
 * WORKSHEET OPERATIONS:
 * 11. add_worksheet - Add a new worksheet to a workbook
 * 12. delete_worksheet - Delete a worksheet from a workbook
 * 13. rename_worksheet - Rename a worksheet
 * 14. list_worksheets - List all worksheets in a workbook
 *
 * DATA OPERATIONS:
 * 15. write_cell - Write data to a specific cell
 * 16. write_range - Write data to a range of cells
 * 17. read_cell - Read data from a specific cell
 * 18. read_range - Read data from a range of cells
 * 19. append_row - Append a row to a worksheet
 * 20. insert_row - Insert a row at a specific position
 *
 * FORMATTING & ADVANCED:
 * 21. format_cells - Apply formatting (font, fill, borders) to cells
 * 22. create_chart - Create charts (bar, line, pie, etc.)
 * 23. add_formula - Add Excel formulas to cells
 * 24. analyze_data - AI-powered data analysis and insights
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
  // WORKBOOK MANAGEMENT
  {
    name: 'create_workbook',
    description: 'Create a new Excel workbook with optional worksheets and data',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (without .xlsx extension)'
        },
        worksheets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of worksheet names to create (optional)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'read_workbook',
    description: 'Read and extract content from an Excel workbook',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'list_workbooks',
    description: 'List all .xlsx Excel workbooks in Azure Blob Storage',
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
    name: 'delete_workbook',
    description: 'Delete an Excel workbook from Azure Blob Storage',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file) to delete'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'get_workbook_url',
    description: 'Get a temporary download URL for an Excel workbook (valid for 1 hour)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        }
      },
      required: ['filename']
    }
  },
  {
    name: 'copy_workbook',
    description: 'Copy/duplicate an Excel workbook',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilename: {
          type: 'string',
          description: 'Source workbook filename (.xlsx file)'
        },
        targetFilename: {
          type: 'string',
          description: 'Target workbook filename (without .xlsx extension)'
        }
      },
      required: ['sourceFilename', 'targetFilename']
    }
  },

  // TEMPLATE MANAGEMENT
  {
    name: 'upload_template',
    description: 'Upload an Excel template to blob storage in the templates/ folder',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .xlsx extension)'
        },
        sourceFilename: {
          type: 'string',
          description: 'Source workbook filename to use as template'
        }
      },
      required: ['templateName', 'sourceFilename']
    }
  },
  {
    name: 'list_templates',
    description: 'List all available Excel templates',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_from_template',
    description: 'Create a new workbook from a template with variable substitution',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .xlsx extension)'
        },
        targetFilename: {
          type: 'string',
          description: 'New workbook filename (without .xlsx extension)'
        },
        variables: {
          type: 'object',
          description: 'Key-value pairs for template variable substitution (replaces {{variableName}} placeholders)'
        }
      },
      required: ['templateName', 'targetFilename']
    }
  },
  {
    name: 'delete_template',
    description: 'Delete an Excel template from storage',
    inputSchema: {
      type: 'object',
      properties: {
        templateName: {
          type: 'string',
          description: 'Template name (without .xlsx extension)'
        }
      },
      required: ['templateName']
    }
  },

  // WORKSHEET OPERATIONS
  {
    name: 'add_worksheet',
    description: 'Add a new worksheet to an existing workbook',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Name of the new worksheet'
        }
      },
      required: ['filename', 'sheetName']
    }
  },
  {
    name: 'delete_worksheet',
    description: 'Delete a worksheet from a workbook',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Name of the worksheet to delete'
        }
      },
      required: ['filename', 'sheetName']
    }
  },
  {
    name: 'rename_worksheet',
    description: 'Rename a worksheet in a workbook',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        oldName: {
          type: 'string',
          description: 'Current worksheet name'
        },
        newName: {
          type: 'string',
          description: 'New worksheet name'
        }
      },
      required: ['filename', 'oldName', 'newName']
    }
  },
  {
    name: 'list_worksheets',
    description: 'List all worksheets in a workbook',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        }
      },
      required: ['filename']
    }
  },

  // DATA OPERATIONS
  {
    name: 'write_cell',
    description: 'Write data to a specific cell',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        cell: {
          type: 'string',
          description: 'Cell address (e.g., "A1", "B5")'
        },
        value: {
          description: 'Value to write (string, number, boolean, or date)'
        }
      },
      required: ['filename', 'sheetName', 'cell', 'value']
    }
  },
  {
    name: 'write_range',
    description: 'Write data to a range of cells',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        startCell: {
          type: 'string',
          description: 'Start cell address (e.g., "A1")'
        },
        data: {
          type: 'array',
          items: {
            type: 'array'
          },
          description: '2D array of data to write (rows and columns)'
        }
      },
      required: ['filename', 'sheetName', 'startCell', 'data']
    }
  },
  {
    name: 'read_cell',
    description: 'Read data from a specific cell',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        cell: {
          type: 'string',
          description: 'Cell address (e.g., "A1", "B5")'
        }
      },
      required: ['filename', 'sheetName', 'cell']
    }
  },
  {
    name: 'read_range',
    description: 'Read data from a range of cells',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        range: {
          type: 'string',
          description: 'Range address (e.g., "A1:C10")'
        }
      },
      required: ['filename', 'sheetName', 'range']
    }
  },
  {
    name: 'append_row',
    description: 'Append a row to the end of a worksheet',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        values: {
          type: 'array',
          description: 'Array of values for the new row'
        }
      },
      required: ['filename', 'sheetName', 'values']
    }
  },
  {
    name: 'insert_row',
    description: 'Insert a row at a specific position in a worksheet',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        rowIndex: {
          type: 'number',
          description: 'Row index where to insert (1-based)'
        },
        values: {
          type: 'array',
          description: 'Array of values for the new row'
        }
      },
      required: ['filename', 'sheetName', 'rowIndex', 'values']
    }
  },

  // FORMATTING & ADVANCED
  {
    name: 'format_cells',
    description: 'Apply formatting (font, fill, borders) to cells',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        range: {
          type: 'string',
          description: 'Cell range to format (e.g., "A1:C10")'
        },
        format: {
          type: 'object',
          description: 'Format options (font, fill, border, alignment, numFmt)'
        }
      },
      required: ['filename', 'sheetName', 'range', 'format']
    }
  },
  {
    name: 'create_chart',
    description: 'Create a chart in a worksheet',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        chartType: {
          type: 'string',
          description: 'Chart type (bar, line, pie, scatter, area)',
          enum: ['bar', 'line', 'pie', 'scatter', 'area']
        },
        dataRange: {
          type: 'string',
          description: 'Data range for the chart (e.g., "A1:C10")'
        },
        title: {
          type: 'string',
          description: 'Chart title (optional)'
        }
      },
      required: ['filename', 'sheetName', 'chartType', 'dataRange']
    }
  },
  {
    name: 'add_formula',
    description: 'Add an Excel formula to a cell or range',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name'
        },
        cell: {
          type: 'string',
          description: 'Cell address (e.g., "A1")'
        },
        formula: {
          type: 'string',
          description: 'Excel formula (e.g., "=SUM(A1:A10)")'
        }
      },
      required: ['filename', 'sheetName', 'cell', 'formula']
    }
  },
  {
    name: 'analyze_data',
    description: 'Use AI to analyze Excel data and provide insights',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Workbook filename (.xlsx file)'
        },
        sheetName: {
          type: 'string',
          description: 'Worksheet name to analyze'
        },
        prompt: {
          type: 'string',
          description: 'Analysis request (e.g., "Find trends", "Summarize sales data")'
        }
      },
      required: ['filename', 'sheetName', 'prompt']
    }
  }
];

// Tool implementation functions

async function createWorkbook(args: any): Promise<string> {
  const { filename, worksheets } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const workbook = new ExcelJS.Workbook();

  if (worksheets && worksheets.length > 0) {
    worksheets.forEach((name: string) => {
      workbook.addWorksheet(name);
    });
  } else {
    workbook.addWorksheet('Sheet1');
  }

  const buffer = await workbook.xlsx.writeBuffer();

  // Upload to blob storage
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  await blockBlobClient.uploadData(Buffer.from(buffer), {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Workbook created: ${workbookFilename}`;
}

async function readWorkbook(args: any): Promise<string> {
  const { filename } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const result: any = {
    filename: workbookFilename,
    worksheets: []
  };

  workbook.eachSheet((worksheet) => {
    const sheetData: any = {
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      data: []
    };

    worksheet.eachRow((row, rowIndex) => {
      const rowData: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData.push(cell.value);
      });
      sheetData.data.push(rowData);
    });

    result.worksheets.push(sheetData);
  });

  return JSON.stringify(result, null, 2);
}

async function listWorkbooks(args: any): Promise<string> {
  const { prefix } = args;
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const workbooks: any[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    if (blob.name.endsWith('.xlsx') && !blob.name.startsWith('templates/')) {
      workbooks.push({
        name: blob.name,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified
      });
    }
  }

  return JSON.stringify(workbooks, null, 2);
}

async function deleteWorkbook(args: any): Promise<string> {
  const { filename } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Workbook ${workbookFilename} not found`);
  }

  await blockBlobClient.delete();

  return `Workbook ${workbookFilename} deleted successfully`;
}

async function getWorkbookUrl(args: any): Promise<string> {
  const { filename } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const exists = await blockBlobClient.exists();
  if (!exists) {
    throw new Error(`Workbook ${workbookFilename} not found`);
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
    blobName: workbookFilename,
    permissions: BlobSASPermissions.parse('r'),
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
  }, sharedKeyCredential).toString();

  const url = `${blockBlobClient.url}?${sasToken}`;

  return JSON.stringify({
    filename: workbookFilename,
    url,
    expiresIn: '1 hour'
  }, null, 2);
}

async function copyWorkbook(args: any): Promise<string> {
  const { sourceFilename, targetFilename } = args;
  const sourceWorkbookFilename = sourceFilename.endsWith('.xlsx') ? sourceFilename : `${sourceFilename}.xlsx`;
  const targetWorkbookFilename = targetFilename.endsWith('.xlsx') ? targetFilename : `${targetFilename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const sourceBlobClient = containerClient.getBlockBlobClient(sourceWorkbookFilename);
  const targetBlobClient = containerClient.getBlockBlobClient(targetWorkbookFilename);

  const exists = await sourceBlobClient.exists();
  if (!exists) {
    throw new Error(`Source workbook ${sourceWorkbookFilename} not found`);
  }

  await targetBlobClient.beginCopyFromURL(sourceBlobClient.url);

  return `Workbook copied from ${sourceWorkbookFilename} to ${targetWorkbookFilename}`;
}

// Template functions
async function uploadTemplate(args: any): Promise<string> {
  const { templateName, sourceFilename } = args;
  const sourceWorkbookFilename = sourceFilename.endsWith('.xlsx') ? sourceFilename : `${sourceFilename}.xlsx`;
  const templateWorkbookFilename = templateName.endsWith('.xlsx') ? templateName : `${templateName}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const sourceBlobClient = containerClient.getBlockBlobClient(sourceWorkbookFilename);
  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateWorkbookFilename}`);

  const exists = await sourceBlobClient.exists();
  if (!exists) {
    throw new Error(`Source workbook ${sourceWorkbookFilename} not found`);
  }

  await templateBlobClient.beginCopyFromURL(sourceBlobClient.url);

  return `Template ${templateWorkbookFilename} uploaded to templates/ folder`;
}

async function listTemplates(args: any): Promise<string> {
  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const templates: any[] = [];

  for await (const blob of containerClient.listBlobsFlat({ prefix: 'templates/' })) {
    if (blob.name.endsWith('.xlsx')) {
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
  const { templateName, targetFilename, variables } = args;
  const templateWorkbookFilename = templateName.endsWith('.xlsx') ? templateName : `${templateName}.xlsx`;
  const targetWorkbookFilename = targetFilename.endsWith('.xlsx') ? targetFilename : `${targetFilename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);

  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateWorkbookFilename}`);
  const exists = await templateBlobClient.exists();
  if (!exists) {
    throw new Error(`Template ${templateWorkbookFilename} not found in templates/ folder`);
  }

  const downloadResponse = await templateBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download template');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  // Replace variables if provided
  if (variables) {
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          if (typeof cell.value === 'string') {
            let newValue = cell.value;
            for (const [key, value] of Object.entries(variables)) {
              const placeholder = `{{${key}}}`;
              newValue = newValue.replace(new RegExp(placeholder, 'g'), value as string);
            }
            if (newValue !== cell.value) {
              cell.value = newValue;
            }
          }
        });
      });
    });
  }

  const newBuffer = await workbook.xlsx.writeBuffer();

  const targetBlobClient = containerClient.getBlockBlobClient(targetWorkbookFilename);
  await targetBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Workbook ${targetWorkbookFilename} created from template ${templateWorkbookFilename}${variables ? ' with variable substitution' : ''}`;
}

async function deleteTemplate(args: any): Promise<string> {
  const { templateName } = args;
  const templateWorkbookFilename = templateName.endsWith('.xlsx') ? templateName : `${templateName}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const templateBlobClient = containerClient.getBlockBlobClient(`templates/${templateWorkbookFilename}`);

  const exists = await templateBlobClient.exists();
  if (!exists) {
    throw new Error(`Template ${templateWorkbookFilename} not found in templates/ folder`);
  }

  await templateBlobClient.delete();

  return `Template ${templateWorkbookFilename} deleted from templates/ folder`;
}

// Worksheet operations
async function addWorksheet(args: any): Promise<string> {
  const { filename, sheetName } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  workbook.addWorksheet(sheetName);

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Worksheet "${sheetName}" added to ${workbookFilename}`;
}

async function deleteWorksheet(args: any): Promise<string> {
  const { filename, sheetName } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  workbook.removeWorksheet(worksheet.id);

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Worksheet "${sheetName}" deleted from ${workbookFilename}`;
}

async function renameWorksheet(args: any): Promise<string> {
  const { filename, oldName, newName } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(oldName);
  if (!worksheet) {
    throw new Error(`Worksheet "${oldName}" not found`);
  }

  worksheet.name = newName;

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Worksheet renamed from "${oldName}" to "${newName}" in ${workbookFilename}`;
}

async function listWorksheets(args: any): Promise<string> {
  const { filename } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheets: any[] = [];
  workbook.eachSheet((worksheet) => {
    worksheets.push({
      name: worksheet.name,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount
    });
  });

  return JSON.stringify(worksheets, null, 2);
}

// Data operations
async function writeCell(args: any): Promise<string> {
  const { filename, sheetName, cell, value } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  worksheet.getCell(cell).value = value;

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Cell ${cell} in "${sheetName}" set to: ${value}`;
}

async function writeRange(args: any): Promise<string> {
  const { filename, sheetName, startCell, data } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  // Parse start cell (e.g., "A1" -> row 1, col 1)
  const cellMatch = startCell.match(/([A-Z]+)(\d+)/);
  if (!cellMatch) {
    throw new Error('Invalid cell address');
  }

  const startRow = parseInt(cellMatch[2]);
  const startCol = cellMatch[1].charCodeAt(0) - 64; // A=1, B=2, etc.

  // Write data array
  data.forEach((row: any[], rowIdx: number) => {
    row.forEach((value: any, colIdx: number) => {
      worksheet.getCell(startRow + rowIdx, startCol + colIdx).value = value;
    });
  });

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Range starting at ${startCell} in "${sheetName}" updated with ${data.length} rows`;
}

async function readCell(args: any): Promise<string> {
  const { filename, sheetName, cell } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  const cellValue = worksheet.getCell(cell).value;

  return JSON.stringify({
    cell,
    worksheet: sheetName,
    value: cellValue
  }, null, 2);
}

async function readRange(args: any): Promise<string> {
  const { filename, sheetName, range } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  const rangeData: any[] = [];
  const rangeObj = worksheet.getCell(range.split(':')[0]).address;

  // Simple range reading
  const [start, end] = range.split(':');
  const startMatch = start.match(/([A-Z]+)(\d+)/);
  const endMatch = end.match(/([A-Z]+)(\d+)/);

  if (!startMatch || !endMatch) {
    throw new Error('Invalid range format');
  }

  const startRow = parseInt(startMatch[2]);
  const endRow = parseInt(endMatch[2]);
  const startCol = startMatch[1].charCodeAt(0) - 64;
  const endCol = endMatch[1].charCodeAt(0) - 64;

  for (let row = startRow; row <= endRow; row++) {
    const rowData: any[] = [];
    for (let col = startCol; col <= endCol; col++) {
      rowData.push(worksheet.getRow(row).getCell(col).value);
    }
    rangeData.push(rowData);
  }

  return JSON.stringify({
    range,
    worksheet: sheetName,
    data: rangeData
  }, null, 2);
}

async function appendRow(args: any): Promise<string> {
  const { filename, sheetName, values } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  worksheet.addRow(values);

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Row appended to "${sheetName}" in ${workbookFilename}`;
}

async function insertRow(args: any): Promise<string> {
  const { filename, sheetName, rowIndex, values } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  worksheet.insertRow(rowIndex, values);

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Row inserted at position ${rowIndex} in "${sheetName}" in ${workbookFilename}`;
}

// Formatting and advanced features
async function formatCells(args: any): Promise<string> {
  const { filename, sheetName, range, format } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  const [start, end] = range.split(':');
  const startMatch = start.match(/([A-Z]+)(\d+)/);
  const endMatch = end ? end.match(/([A-Z]+)(\d+)/) : startMatch;

  if (!startMatch || !endMatch) {
    throw new Error('Invalid range format');
  }

  const startRow = parseInt(startMatch[2]);
  const endRow = parseInt(endMatch[2]);
  const startCol = startMatch[1].charCodeAt(0) - 64;
  const endCol = endMatch[1].charCodeAt(0) - 64;

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getRow(row).getCell(col);
      if (format.font) cell.font = format.font;
      if (format.fill) cell.fill = format.fill;
      if (format.border) cell.border = format.border;
      if (format.alignment) cell.alignment = format.alignment;
      if (format.numFmt) cell.numFmt = format.numFmt;
    }
  }

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Formatting applied to range ${range} in "${sheetName}"`;
}

async function createChart(args: any): Promise<string> {
  const { filename, sheetName, chartType, dataRange, title } = args;
  // Note: ExcelJS has limited chart support, this is a placeholder
  return `Chart creation for ${chartType} in ${sheetName} with data ${dataRange} (feature in development)`;
}

async function addFormula(args: any): Promise<string> {
  const { filename, sheetName, cell, formula } = args;
  const workbookFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
  const blobClient = getBlobClient();
  const containerClient = blobClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(workbookFilename);

  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download workbook');
  }

  const buffer = await streamToBuffer(downloadResponse.readableStreamBody);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

  const targetCell = worksheet.getCell(cell);
  targetCell.value = { formula };

  const newBuffer = await workbook.xlsx.writeBuffer();

  await blockBlobClient.uploadData(newBuffer as Buffer, {
    blobHTTPHeaders: {
      blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });

  return `Formula "${formula}" added to cell ${cell} in "${sheetName}"`;
}

async function analyzeData(args: any): Promise<string> {
  const { filename, sheetName, prompt } = args;

  // First, read the worksheet data
  const workbookContent = await readWorkbook({ filename });
  const parsedContent = JSON.parse(workbookContent);

  // Find the specific worksheet
  const worksheet = parsedContent.worksheets.find((ws: any) => ws.name === sheetName);
  if (!worksheet) {
    throw new Error(`Worksheet "${sheetName}" not found`);
  }

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

Worksheet data from "${sheetName}":
${JSON.stringify(worksheet.data, null, 2)}`
    }]
  });

  const analysis = response.content[0].type === 'text' ? response.content[0].text : '';

  return JSON.stringify({
    filename,
    worksheet: sheetName,
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
              name: 'excel-mcp-server',
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
          // Workbook Management
          case 'create_workbook':
            result = await createWorkbook(args);
            break;
          case 'read_workbook':
            result = await readWorkbook(args);
            break;
          case 'list_workbooks':
            result = await listWorkbooks(args || {});
            break;
          case 'delete_workbook':
            result = await deleteWorkbook(args);
            break;
          case 'get_workbook_url':
            result = await getWorkbookUrl(args);
            break;
          case 'copy_workbook':
            result = await copyWorkbook(args);
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

          // Worksheet Operations
          case 'add_worksheet':
            result = await addWorksheet(args);
            break;
          case 'delete_worksheet':
            result = await deleteWorksheet(args);
            break;
          case 'rename_worksheet':
            result = await renameWorksheet(args);
            break;
          case 'list_worksheets':
            result = await listWorksheets(args);
            break;

          // Data Operations
          case 'write_cell':
            result = await writeCell(args);
            break;
          case 'write_range':
            result = await writeRange(args);
            break;
          case 'read_cell':
            result = await readCell(args);
            break;
          case 'read_range':
            result = await readRange(args);
            break;
          case 'append_row':
            result = await appendRow(args);
            break;
          case 'insert_row':
            result = await insertRow(args);
            break;

          // Formatting & Advanced
          case 'format_cells':
            result = await formatCells(args);
            break;
          case 'create_chart':
            result = await createChart(args);
            break;
          case 'add_formula':
            result = await addFormula(args);
            break;
          case 'analyze_data':
            result = await analyzeData(args);
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
    console.error('Excel MCP Error:', error);
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
