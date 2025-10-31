import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * n8n MCP Server Endpoint - Full Toolset
 *
 * This endpoint implements a comprehensive MCP (Model Context Protocol) server interface
 * for n8n workflow automation with access to ALL n8n API capabilities.
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
      // Return comprehensive toolset
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            // Workflow Management Tools
            {
              name: 'list_workflows',
              description: 'List all available n8n workflows with filtering options',
              inputSchema: {
                type: 'object',
                properties: {
                  active: { type: 'boolean', description: 'Filter by active status' },
                  tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
                },
              },
            },
            {
              name: 'get_workflow_details',
              description: 'Get detailed information about a specific workflow including nodes, connections, and configuration',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the workflow to inspect' },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'create_workflow',
              description: 'Create a new n8n workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the workflow' },
                  nodes: { type: 'array', description: 'Array of workflow nodes' },
                  connections: { type: 'object', description: 'Workflow connections object' },
                  settings: { type: 'object', description: 'Workflow settings' },
                  active: { type: 'boolean', description: 'Whether the workflow should be active' },
                },
                required: ['name'],
              },
            },
            {
              name: 'update_workflow',
              description: 'Update an existing n8n workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the workflow to update' },
                  name: { type: 'string', description: 'New name for the workflow' },
                  nodes: { type: 'array', description: 'Updated array of workflow nodes' },
                  connections: { type: 'object', description: 'Updated workflow connections' },
                  settings: { type: 'object', description: 'Updated workflow settings' },
                  active: { type: 'boolean', description: 'Active status' },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'delete_workflow',
              description: 'Delete an n8n workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the workflow to delete' },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'activate_workflow',
              description: 'Activate an n8n workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the workflow to activate' },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'deactivate_workflow',
              description: 'Deactivate an n8n workflow',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the workflow to deactivate' },
                },
                required: ['workflowId'],
              },
            },

            // Execution Tools
            {
              name: 'execute_workflow',
              description: 'Execute an n8n workflow manually with optional input data',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'The ID of the n8n workflow to execute' },
                  data: { type: 'object', description: 'Optional input data to pass to the workflow', additionalProperties: true },
                },
                required: ['workflowId'],
              },
            },
            {
              name: 'get_execution_details',
              description: 'Get detailed information about a specific workflow execution',
              inputSchema: {
                type: 'object',
                properties: {
                  executionId: { type: 'string', description: 'The execution ID to get details for' },
                },
                required: ['executionId'],
              },
            },
            {
              name: 'list_executions',
              description: 'List recent workflow executions with filtering options',
              inputSchema: {
                type: 'object',
                properties: {
                  workflowId: { type: 'string', description: 'Filter by workflow ID' },
                  status: { type: 'string', enum: ['success', 'error', 'waiting', 'running'], description: 'Filter by status' },
                  limit: { type: 'number', description: 'Maximum number of executions to return (default: 20)' },
                },
              },
            },
            {
              name: 'delete_execution',
              description: 'Delete a workflow execution from history',
              inputSchema: {
                type: 'object',
                properties: {
                  executionId: { type: 'string', description: 'The execution ID to delete' },
                },
                required: ['executionId'],
              },
            },
            {
              name: 'retry_execution',
              description: 'Retry a failed workflow execution',
              inputSchema: {
                type: 'object',
                properties: {
                  executionId: { type: 'string', description: 'The execution ID to retry' },
                },
                required: ['executionId'],
              },
            },

            // Credential Management Tools
            {
              name: 'list_credentials',
              description: 'List all available credentials (sensitive data masked)',
              inputSchema: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Filter by credential type' },
                },
              },
            },
            {
              name: 'get_credential_types',
              description: 'Get list of all available credential types in n8n',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },

            // Tag Management Tools
            {
              name: 'list_tags',
              description: 'List all workflow tags',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'create_tag',
              description: 'Create a new workflow tag',
              inputSchema: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Name of the tag' },
                },
                required: ['name'],
              },
            },
            {
              name: 'update_tag',
              description: 'Update an existing tag',
              inputSchema: {
                type: 'object',
                properties: {
                  tagId: { type: 'string', description: 'The ID of the tag to update' },
                  name: { type: 'string', description: 'New name for the tag' },
                },
                required: ['tagId', 'name'],
              },
            },
            {
              name: 'delete_tag',
              description: 'Delete a workflow tag',
              inputSchema: {
                type: 'object',
                properties: {
                  tagId: { type: 'string', description: 'The ID of the tag to delete' },
                },
                required: ['tagId'],
              },
            },

            // System & Information Tools
            {
              name: 'get_node_types',
              description: 'Get list of all available node types in n8n',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'search_workflows',
              description: 'Search workflows by name, tags, or other criteria',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query' },
                  tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
                  active: { type: 'boolean', description: 'Filter by active status' },
                },
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

      // Workflow Management
      if (name === 'list_workflows') {
        result = await listWorkflows(n8nApiKey, toolArgs);
      } else if (name === 'get_workflow_details') {
        result = await getWorkflowDetails(n8nApiKey, toolArgs.workflowId);
      } else if (name === 'create_workflow') {
        result = await createWorkflow(n8nApiKey, toolArgs);
      } else if (name === 'update_workflow') {
        result = await updateWorkflow(n8nApiKey, toolArgs);
      } else if (name === 'delete_workflow') {
        result = await deleteWorkflow(n8nApiKey, toolArgs.workflowId);
      } else if (name === 'activate_workflow') {
        result = await activateWorkflow(n8nApiKey, toolArgs.workflowId);
      } else if (name === 'deactivate_workflow') {
        result = await deactivateWorkflow(n8nApiKey, toolArgs.workflowId);
      }

      // Execution Management
      else if (name === 'execute_workflow') {
        result = await executeWorkflow(n8nApiKey, toolArgs.workflowId, toolArgs.data);
      } else if (name === 'get_execution_details') {
        result = await getExecutionDetails(n8nApiKey, toolArgs.executionId);
      } else if (name === 'list_executions') {
        result = await listExecutions(n8nApiKey, toolArgs);
      } else if (name === 'delete_execution') {
        result = await deleteExecution(n8nApiKey, toolArgs.executionId);
      } else if (name === 'retry_execution') {
        result = await retryExecution(n8nApiKey, toolArgs.executionId);
      }

      // Credential Management
      else if (name === 'list_credentials') {
        result = await listCredentials(n8nApiKey, toolArgs);
      } else if (name === 'get_credential_types') {
        result = await getCredentialTypes(n8nApiKey);
      }

      // Tag Management
      else if (name === 'list_tags') {
        result = await listTags(n8nApiKey);
      } else if (name === 'create_tag') {
        result = await createTag(n8nApiKey, toolArgs.name);
      } else if (name === 'update_tag') {
        result = await updateTag(n8nApiKey, toolArgs.tagId, toolArgs.name);
      } else if (name === 'delete_tag') {
        result = await deleteTag(n8nApiKey, toolArgs.tagId);
      }

      // System Tools
      else if (name === 'get_node_types') {
        result = await getNodeTypes(n8nApiKey);
      } else if (name === 'search_workflows') {
        result = await searchWorkflows(n8nApiKey, toolArgs);
      }

      else {
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

// ============================================================================
// WORKFLOW MANAGEMENT FUNCTIONS
// ============================================================================

async function listWorkflows(apiKey: string, filters?: any) {
  let url = `${N8N_API_URL}/workflows`;
  const params = new URLSearchParams();

  if (filters?.active !== undefined) params.append('active', String(filters.active));
  if (filters?.tags?.length) params.append('tags', filters.tags.join(','));

  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url, {
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
        tags: wf.tags || [],
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
      })),
      count: data.data.length,
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

async function createWorkflow(apiKey: string, workflowData: any) {
  const response = await fetch(`${N8N_API_URL}/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(workflowData),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      message: 'Workflow created successfully',
      workflow: {
        id: data.data.id,
        name: data.data.name,
        active: data.data.active,
      },
    }, null, 2),
  };
}

async function updateWorkflow(apiKey: string, updateData: any) {
  const { workflowId, ...workflowData } = updateData;

  const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
    method: 'PATCH',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(workflowData),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      message: 'Workflow updated successfully',
      workflow: {
        id: data.data.id,
        name: data.data.name,
        active: data.data.active,
        updatedAt: data.data.updatedAt,
      },
    }, null, 2),
  };
}

async function deleteWorkflow(apiKey: string, workflowId: string) {
  const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  return {
    content: JSON.stringify({
      message: 'Workflow deleted successfully',
      workflowId: workflowId,
    }, null, 2),
  };
}

async function activateWorkflow(apiKey: string, workflowId: string) {
  return await updateWorkflow(apiKey, { workflowId, active: true });
}

async function deactivateWorkflow(apiKey: string, workflowId: string) {
  return await updateWorkflow(apiKey, { workflowId, active: false });
}

async function searchWorkflows(apiKey: string, searchParams: any) {
  const allWorkflows = await listWorkflows(apiKey, searchParams);
  const workflows = JSON.parse(allWorkflows.content).workflows;

  let filtered = workflows;

  if (searchParams.query) {
    const query = searchParams.query.toLowerCase();
    filtered = filtered.filter((wf: any) =>
      wf.name.toLowerCase().includes(query)
    );
  }

  return {
    content: JSON.stringify({
      workflows: filtered,
      count: filtered.length,
      query: searchParams.query,
    }, null, 2),
  };
}

// ============================================================================
// EXECUTION MANAGEMENT FUNCTIONS
// ============================================================================

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

async function getExecutionDetails(apiKey: string, executionId: string) {
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
      workflowId: data.data.workflowId,
      status: data.data.finished ? (data.data.stoppedAt ? 'stopped' : 'completed') : 'running',
      startedAt: data.data.startedAt,
      stoppedAt: data.data.stoppedAt,
      mode: data.data.mode,
      data: data.data.data,
    }, null, 2),
  };
}

async function listExecutions(apiKey: string, filters?: any) {
  let url = `${N8N_API_URL}/executions`;
  const params = new URLSearchParams();

  if (filters?.workflowId) params.append('workflowId', filters.workflowId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', String(filters.limit));
  else params.append('limit', '20');

  if (params.toString()) url += `?${params.toString()}`;

  const response = await fetch(url, {
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
      executions: data.data.map((exec: any) => ({
        id: exec.id,
        workflowId: exec.workflowId,
        status: exec.finished ? (exec.stoppedAt ? 'stopped' : 'completed') : 'running',
        startedAt: exec.startedAt,
        stoppedAt: exec.stoppedAt,
        mode: exec.mode,
      })),
      count: data.data.length,
    }, null, 2),
  };
}

async function deleteExecution(apiKey: string, executionId: string) {
  const response = await fetch(`${N8N_API_URL}/executions/${executionId}`, {
    method: 'DELETE',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  return {
    content: JSON.stringify({
      message: 'Execution deleted successfully',
      executionId: executionId,
    }, null, 2),
  };
}

async function retryExecution(apiKey: string, executionId: string) {
  const response = await fetch(`${N8N_API_URL}/executions/${executionId}/retry`, {
    method: 'POST',
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
      message: 'Execution retried successfully',
      newExecutionId: data.data.id,
      status: data.data.finished ? 'completed' : 'running',
    }, null, 2),
  };
}

// ============================================================================
// CREDENTIAL MANAGEMENT FUNCTIONS
// ============================================================================

async function listCredentials(apiKey: string, filters?: any) {
  let url = `${N8N_API_URL}/credentials`;

  if (filters?.type) {
    url += `?type=${filters.type}`;
  }

  const response = await fetch(url, {
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
      credentials: data.data.map((cred: any) => ({
        id: cred.id,
        name: cred.name,
        type: cred.type,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
      })),
      count: data.data.length,
    }, null, 2),
  };
}

async function getCredentialTypes(apiKey: string) {
  const response = await fetch(`${N8N_API_URL}/credential-types`, {
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
      credentialTypes: data.data.map((type: any) => ({
        name: type.name,
        displayName: type.displayName,
        documentationUrl: type.documentationUrl,
      })),
      count: data.data.length,
    }, null, 2),
  };
}

// ============================================================================
// TAG MANAGEMENT FUNCTIONS
// ============================================================================

async function listTags(apiKey: string) {
  const response = await fetch(`${N8N_API_URL}/tags`, {
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
      tags: data.data.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      })),
      count: data.data.length,
    }, null, 2),
  };
}

async function createTag(apiKey: string, name: string) {
  const response = await fetch(`${N8N_API_URL}/tags`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      message: 'Tag created successfully',
      tag: {
        id: data.data.id,
        name: data.data.name,
      },
    }, null, 2),
  };
}

async function updateTag(apiKey: string, tagId: string, name: string) {
  const response = await fetch(`${N8N_API_URL}/tags/${tagId}`, {
    method: 'PATCH',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: JSON.stringify({
      message: 'Tag updated successfully',
      tag: {
        id: data.data.id,
        name: data.data.name,
      },
    }, null, 2),
  };
}

async function deleteTag(apiKey: string, tagId: string) {
  const response = await fetch(`${N8N_API_URL}/tags/${tagId}`, {
    method: 'DELETE',
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
  }

  return {
    content: JSON.stringify({
      message: 'Tag deleted successfully',
      tagId: tagId,
    }, null, 2),
  };
}

// ============================================================================
// SYSTEM TOOLS
// ============================================================================

async function getNodeTypes(apiKey: string) {
  const response = await fetch(`${N8N_API_URL}/node-types`, {
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
      nodeTypes: data.data.map((type: any) => ({
        name: type.name,
        displayName: type.displayName,
        description: type.description,
        version: type.version,
        defaults: type.defaults,
        inputs: type.inputs,
        outputs: type.outputs,
      })),
      count: data.data.length,
    }, null, 2),
  };
}
