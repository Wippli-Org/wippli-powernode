import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { TableClient } from '@azure/data-tables';

/**
 * Python Excel Analysis MCP Server HTTP Wrapper
 * Provides advanced Excel analysis using openpyxl:
 * - extract_comments: Extract all Excel comments
 * - extract_questions: Find all cells with questions
 * - detect_hidden_content: List hidden rows/columns
 * - comprehensive_analysis: Full workbook analysis
 */

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';

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

// MCP Tool Definitions
const TOOLS = [
  {
    name: 'extract_comments',
    description: 'Extract all Excel comments from a workbook. Returns comments with cell location, content, and author.',
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
    name: 'extract_questions',
    description: 'Find all cells containing questions (cells with \'?\').  Automatically detects answers in adjacent cells.',
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
    name: 'detect_hidden_content',
    description: 'List all hidden rows, columns, and worksheets. Shows which content is hidden in the workbook.',
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
    name: 'comprehensive_analysis',
    description: 'Full workbook analysis - extracts comments, questions, hidden content, and provides summary statistics.',
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
  }
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { method, params, id, fileContent } = req.body;

  try {
    // Handle MCP protocol methods
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'excel-python-mcp',
            version: '1.0.0'
          }
        }
      });
    }

    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      });
    }

    if (method === 'tools/call') {
      const { name: toolName, arguments: args } = params;
      const filename = args.filename;

      // Get file buffer - either from provided fileContent or fetch from storage
      let fileBuffer: Buffer;

      if (fileContent) {
        // File provided directly (base64 encoded)
        fileBuffer = Buffer.from(fileContent, 'base64');
        console.log(`📦 Using provided file buffer: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
      } else {
        // Fetch from Azure Blob Storage or OneDrive
        console.log(`📥 Fetching file from storage: ${filename}`);
        const containerName = process.env.DEFAULT_CONTAINER || 'wippli-documents';
        const blobServiceClient = BlobServiceClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);

        const exists = await blockBlobClient.exists();
        if (!exists) {
          // Try OneDrive fallback
          console.log(`📥 File not in blob, trying OneDrive: ${filename}`);
          try {
            const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, 'powernodeOneDriveConfig');
            const oneDriveEntity = await tableClient.getEntity('default-user', 'onedrive-config');

            if (!oneDriveEntity.accessToken) {
              throw new Error('OneDrive not configured');
            }

            const searchResponse = await fetch(
              `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(filename)}')`,
              {
                headers: {
                  'Authorization': `Bearer ${oneDriveEntity.accessToken}`,
                },
              }
            );

            if (!searchResponse.ok) {
              throw new Error(`OneDrive search failed: ${searchResponse.statusText}`);
            }

            const searchData = await searchResponse.json();
            if (!searchData.value || searchData.value.length === 0) {
              throw new Error(`File "${filename}" not found in OneDrive or blob storage`);
            }

            const file = searchData.value[0];
            const downloadResponse = await fetch(
              `https://graph.microsoft.com/v1.0/me/drive/items/${file.id}/content`,
              {
                headers: {
                  'Authorization': `Bearer ${oneDriveEntity.accessToken}`,
                },
              }
            );

            if (!downloadResponse.ok) {
              throw new Error(`Failed to download from OneDrive: ${downloadResponse.statusText}`);
            }

            fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());
            console.log(`✅ Downloaded from OneDrive: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
          } catch (oneDriveError: any) {
            throw new Error(`File "${filename}" not found: ${oneDriveError.message}`);
          }
        } else {
          const downloadResponse = await blockBlobClient.download();
          if (!downloadResponse.readableStreamBody) {
            throw new Error('Failed to download file from blob storage');
          }
          fileBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
          console.log(`✅ Downloaded from blob: ${(fileBuffer.length / 1024).toFixed(2)}KB`);
        }
      }

      // Call Python MCP server
      const pythonServerPath = path.join(process.cwd(), 'mcp-servers', 'excel-python-server.py');
      console.log(`🐍 Calling Python MCP server: ${pythonServerPath}`);

      const pythonProcess = spawn('python3', [pythonServerPath]);

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(`🐍 Python stderr: ${data.toString()}`);
      });

      // Send request to Python process
      const mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        fileContent: fileBuffer.toString('base64')
      };

      pythonProcess.stdin.write(JSON.stringify(mcpRequest) + '\n');
      pythonProcess.stdin.end();

      // Wait for process to complete
      await new Promise<void>((resolve, reject) => {
        pythonProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
          }
        });

        pythonProcess.on('error', (err) => {
          reject(new Error(`Failed to start Python process: ${err.message}`));
        });
      });

      // Parse response
      const lines = stdoutData.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const pythonResponse = JSON.parse(lastLine);

      if (pythonResponse.error) {
        throw new Error(pythonResponse.error.message || 'Python MCP error');
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result: pythonResponse.result
      });
    }

    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    });

  } catch (error: any) {
    console.error('Error in Python Excel MCP:', error);

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
