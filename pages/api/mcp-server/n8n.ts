import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * n8n MCP Server Endpoint
 *
 * This endpoint implements the MCP (Model Context Protocol) server interface
 * for n8n workflow automation. It translates MCP JSON-RPC calls into n8n API calls.
 *
 * Usage: Configure this as your MCP server URL in the MCP Tools page:
 * https://your-domain.com/api/mcp-server/n8n
 *
 * The API key should be configured in the MCP Tools page and will be passed via Authorization header.
 */

const N8N_API_URL = process.env.N8N_API_URL || 'https://n8n.brannium.com/api/v1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract API key from Authorization header (sent by execute-tool API)
  const authHeader = req.headers.authorization;
  const n8nApiKey = authHeader?.replace('Bearer ', '');

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
      // Return available tools
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'list_workflows',
              description: 'List all available n8n workflows',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'execute_workflow',
              description: 'Execute an n8n workflow by workflow ID',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: {
                    type: 'string',
                    description: 'The ID of the n8n workflow to execute',
                  },
                  data: {
                    type: 'object',
                    description: 'Optional input data to pass to the workflow',
                    additionalProperties: true,
                  },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'get_workflow_status',
              description: 'Get the execution status of a workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  executionId: {
                    type: 'string',
                    description: 'The execution ID to check status for',
                  },
                },
                required: ['executionId'],
              },
            },
            {
              name: 'get_workflow_details',
              description: 'Get detailed information about a specific workflow including its nodes, connections, and configuration',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: {
                    type: 'string',
                    description: 'The ID of the workflow to inspect',
                  },
                },
                required: ['workflowId'],
              },
            },
          ],
        },
      });
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params;

      // Check for API key
      if (!n8nApiKey) {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            content: 'Error: n8n API key is not configured. Please add an API key in the MCP Tools page.',
            isError: true,
          },
        });
      }

      // Handle tool execution
      let result;

      if (name === 'list_workflows') {
        result = await listWorkflows(n8nApiKey);
      } else if (name === 'execute_workflow') {
        result = await executeWorkflow(n8nApiKey, toolArgs.workflowId, toolArgs.data);
      } else if (name === 'get_workflow_status') {
        result = await getWorkflowStatus(n8nApiKey, toolArgs.executionId);
      } else if (name === 'get_workflow_details') {
        result = await getWorkflowDetails(n8nApiKey, toolArgs.workflowId);
      } else {
        return res.status(200).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${name}`,
          },
        });
      }

      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result,
      });
    }

    // Method not supported
    return res.status(200).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    });
  } catch (error: any) {
    console.error('MCP Server Error:', error);

    return res.status(200).json({
      jsonrpc: '2.0',
      id: id || null,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message,
      },
    });
  }
}

async function listWorkflows(apiKey: string) {
  const response = await fetch(`${N8N_API_URL}/workflows`, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      workflows: data.data.map((wf: any) => ({
        id: wf.id,
        name: wf.name,
        active: wf.active,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
      })),
      count: data.data.length,
    }, null, 2),
  };
}

async function executeWorkflow(apiKey: string, workflowId: string, inputData?: any) {
  const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(inputData || {}),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      executionId: data.data.executionId,
      status: data.data.finished ? 'completed' : 'running',
      data: data.data,
    }, null, 2),
  };
}

async function getWorkflowStatus(apiKey: string, executionId: string) {
  const response = await fetch(`${N8N_API_URL}/executions/${executionId}`, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      executionId: data.data.id,
      status: data.data.finished ? (data.data.stoppedAt ? 'stopped' : 'completed') : 'running',
      startedAt: data.data.startedAt,
      stoppedAt: data.data.stoppedAt,
      mode: data.data.mode,
      workflowId: data.data.workflowId,
    }, null, 2),
  };
}

async function getWorkflowDetails(apiKey: string, workflowId: string) {
  const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const workflow = data.data;

  // Extract node information
  const nodes = workflow.nodes?.map((node: any) => ({
    name: node.name,
    type: node.type,
    position: node.position,
    parameters: node.parameters,
  })) || [];

  // Extract connection information
  const connections = workflow.connections || {};

  return {
    content: JSON.stringify({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      nodeCount: nodes.length,
      nodes: nodes,
      connections: connections,
      tags: workflow.tags || [],
      settings: workflow.settings || {},
    }, null, 2),
  };
}
