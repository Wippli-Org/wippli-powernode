import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Microsoft Word MCP Server Endpoint - Universal Document Manipulation
 *
 * This endpoint implements a comprehensive MCP (Model Context Protocol) server interface
 * for Microsoft Word document manipulation with AI-powered questionnaire filling.
 *
 * Usage: Configure this as your MCP server URL in the MCP Tools page:
 * https://your-domain.com/api/mcp-server/word
 *
 * The Word Engine backend URL should be configured via WORD_ENGINE_URL environment variable.
 */

const WORD_ENGINE_URL = process.env.WORD_ENGINE_URL || 'http://localhost:8000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract configuration from Authorization header (sent by execute-tool API)
  const authHeader = req.headers.authorization;
  const configJson = authHeader?.replace('Bearer ', '');

  let azureStorageConnection = '';
  let anthropicApiKey = '';

  if (configJson) {
    try {
      const config = JSON.parse(configJson);
      azureStorageConnection = config.azureStorageConnection || '';
      anthropicApiKey = config.anthropicApiKey || '';
    } catch (e) {
      // If not JSON, treat as simple API key for backwards compatibility
      anthropicApiKey = configJson;
    }
  }

  const { jsonrpc, id, method, params } = req.body;

  // Validate JSON-RPC request
  if (jsonrpc !== '2.0' || !method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    });
  }

  try {
    // Handle MCP methods
    if (method === 'tools/list') {
      // Return Word document manipulation tools
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            // Document CRUD Operations
            {
              name: 'create_document',
              description: 'Create a new Word document from scratch or with a title',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path where document will be saved in blob storage' },
                  title: { type: 'string', description: 'Optional title for the document' },
                  container: { type: 'string', description: 'Azure blob container (default: wippli-documents)' },
                },
                required: ['file_path'],
              },
            },
            {
              name: 'read_document',
              description: 'Read a Word document and extract its structure, content, paragraphs, and tables',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document in blob storage' },
                  container: { type: 'string', description: 'Azure blob container (default: wippli-documents)' },
                },
                required: ['file_path'],
              },
            },
            {
              name: 'list_documents',
              description: 'List all Word documents in Azure blob storage container',
              inputSchema: {
                type: 'object',
                properties: {
                  container: { type: 'string', description: 'Azure blob container (default: wippli-documents)' },
                  prefix: { type: 'string', description: 'Filter documents by path prefix' },
                },
              },
            },
            {
              name: 'delete_document',
              description: 'Delete a Word document from blob storage',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document to delete' },
                  container: { type: 'string', description: 'Azure blob container (default: wippli-documents)' },
                },
                required: ['file_path'],
              },
            },

            // Content Manipulation
            {
              name: 'add_paragraph',
              description: 'Add a text paragraph to an existing Word document with optional formatting',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document' },
                  text: { type: 'string', description: 'Paragraph text content' },
                  style: { type: 'string', description: 'Paragraph style (e.g., Normal, Heading 1)' },
                  font_size: { type: 'number', description: 'Font size in points' },
                  bold: { type: 'boolean', description: 'Make text bold' },
                  italic: { type: 'boolean', description: 'Make text italic' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path', 'text'],
              },
            },
            {
              name: 'add_heading',
              description: 'Add a heading to a Word document with specified level (1-9)',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document' },
                  text: { type: 'string', description: 'Heading text' },
                  level: { type: 'number', description: 'Heading level (1-9, default: 1)' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path', 'text'],
              },
            },
            {
              name: 'add_table',
              description: 'Create a table in a Word document with specified rows and columns',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document' },
                  rows: { type: 'number', description: 'Number of rows' },
                  cols: { type: 'number', description: 'Number of columns' },
                  data: { type: 'array', description: 'Array of arrays containing table data', items: { type: 'array' } },
                  style: { type: 'string', description: 'Table style name' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path', 'rows', 'cols'],
              },
            },
            {
              name: 'replace_text',
              description: 'Find and replace text globally in a Word document (paragraphs and tables)',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document' },
                  find: { type: 'string', description: 'Text to find' },
                  replace: { type: 'string', description: 'Replacement text' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path', 'find', 'replace'],
              },
            },

            // AI-Powered Questionnaire Engine (CORE INNOVATION)
            {
              name: 'analyze_questionnaire',
              description: 'AI-powered analysis of ANY questionnaire structure. Detects sections, questions, form fields, rating scales, and field types. Works with any language and format.',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the questionnaire document' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path'],
              },
            },
            {
              name: 'extract_form_fields',
              description: 'Extract all fillable form fields from a Word document including checkboxes, fill-in-blanks, rating scales, and table cells',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the document' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path'],
              },
            },
            {
              name: 'fill_questionnaire_from_json',
              description: 'Auto-fill questionnaire from structured JSON data using AI-powered semantic matching. Intelligently matches answers to questions across languages.',
              inputSchema: {
                type: 'object',
                properties: {
                  file_path: { type: 'string', description: 'Path to the questionnaire document' },
                  answers: { type: 'object', description: 'JSON object mapping question identifiers to answers' },
                  container: { type: 'string', description: 'Azure blob container' },
                },
                required: ['file_path', 'answers'],
              },
            },
          ],
        },
      });
    }

    // Handle tools/call - forward to Word Engine backend
    if (method === 'tools/call') {
      const { name: toolName, arguments: toolArgs } = params;

      // Forward request to Word Engine with authentication
      const wordEngineResponse = await fetch(`${WORD_ENGINE_URL}/mcp/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Azure-Storage-Connection': azureStorageConnection,
          'X-Anthropic-API-Key': anthropicApiKey,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: toolName,
          params: toolArgs,
        }),
      });

      if (!wordEngineResponse.ok) {
        const errorText = await wordEngineResponse.text();
        throw new Error(`Word Engine error: ${wordEngineResponse.status} - ${errorText}`);
      }

      const result = await wordEngineResponse.json();
      return res.status(200).json(result);
    }

    // Unknown method
    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    });

  } catch (error: any) {
    console.error('Word MCP Server error:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal server error',
      },
    });
  }
}
