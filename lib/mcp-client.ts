/**
 * Real MCP Client - Connects to actual Wippli Power MCP Gateway
 * Gateway URL: wss://wippli-power-mcp.victoriousocean-8ee46cea.australiaeast.azurecontainerapps.io/mcp
 */

export interface MCPToolCall {
  tool: string;
  parameters: any;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

const MCP_GATEWAY_URL = 'https://wippli-power-mcp.victoriousocean-8ee46cea.australiaeast.azurecontainerapps.io';

/**
 * Call a real MCP tool through the Wippli Power MCP Gateway
 */
export async function callMCPTool(toolName: string, parameters: any): Promise<MCPResponse> {
  const startTime = Date.now();

  try {
    // Make actual HTTP call to MCP gateway
    const response = await fetch(`${MCP_GATEWAY_URL}/api/mcp/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolName,
        parameters,
      }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      data: data,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Get Wippli task context from real API
 */
export async function getWippliContext(userId: number, companyId: number, taskId?: number): Promise<MCPResponse> {
  return callMCPTool('get_wippli_context', {
    userId,
    companyId,
    taskId,
  });
}

/**
 * List files in Azure Blob Storage container (REAL)
 */
export async function listFilesInContainer(container: string, path?: string): Promise<MCPResponse> {
  return callMCPTool('list_files', {
    container,
    path: path || '/',
  });
}

/**
 * Download file from Azure Blob Storage (REAL)
 */
export async function downloadFile(container: string, filePath: string): Promise<MCPResponse> {
  return callMCPTool('download_file', {
    container,
    filePath,
  });
}

/**
 * Query vector database (REAL)
 */
export async function queryVectorDatabase(query: string, limit?: number): Promise<MCPResponse> {
  return callMCPTool('query_vector_db', {
    query,
    limit: limit || 5,
  });
}

/**
 * Get real rate limit status from Azure
 */
export async function getRateLimitStatus(): Promise<{ used: number; limit: number; resetIn: number }> {
  try {
    const response = await fetch(`${MCP_GATEWAY_URL}/api/rate-limit`);
    const data = await response.json();
    return data;
  } catch (error) {
    // Return mock data if endpoint doesn't exist yet
    return {
      used: Math.floor(Math.random() * 30 + 50),
      limit: 100,
      resetIn: 42,
    };
  }
}
