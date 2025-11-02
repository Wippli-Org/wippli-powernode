import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn, ChildProcess } from 'child_process';

/**
 * Word MCP Server Endpoint - TypeScript Proxy to Python MCP Server
 *
 * This endpoint proxies JSON-RPC requests to the Python MCP server running as child process.
 * The Python server uses the official MCP SDK and handles Word document operations.
 */

// Singleton Python MCP server process
let pythonProcess: ChildProcess | null = null;
let requestCounter = 0;
const pendingRequests = new Map<number, {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}>();

/**
 * Initialize Python MCP server as child process
 */
function initPythonServer() {
  if (pythonProcess) return;

  pythonProcess = spawn('python3', [
    './mcp-servers/word/server.py'
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    }
  });

  // Handle stdout (JSON-RPC responses)
  let buffer = '';
  pythonProcess.stdout?.on('data', (data) => {
    buffer += data.toString();

    // Try to parse complete JSON objects
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        const id = response.id;
        const pending = pendingRequests.get(id);

        if (pending) {
          pending.resolve(response);
          pendingRequests.delete(id);
        }
      } catch (e) {
        console.error('[Word MCP] Failed to parse response:', e);
      }
    }
  });

  // Handle stderr (logging)
  pythonProcess.stderr?.on('data', (data) => {
    console.error('[Word MCP]', data.toString());
  });

  // Handle process exit
  pythonProcess.on('exit', (code) => {
    console.log(`[Word MCP] Python process exited with code ${code}`);
    pythonProcess = null;

    // Reject all pending requests
    for (const [id, pending] of pendingRequests.entries()) {
      pending.reject(new Error('Python process exited'));
      pendingRequests.delete(id);
    }
  });
}

/**
 * Send JSON-RPC request to Python MCP server
 */
async function callPythonMCP(request: any): Promise<any> {
  initPythonServer();

  return new Promise((resolve, reject) => {
    const id = ++requestCounter;
    const requestWithId = { ...request, id };

    pendingRequests.set(id, { resolve, reject });

    // Send to Python stdin
    pythonProcess?.stdin?.write(JSON.stringify(requestWithId) + '\n');

    // Timeout after 30 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);
  });
}

/**
 * Next.js API route handler
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
    // Forward to Python MCP server
    const response = await callPythonMCP(req.body);
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[Word MCP] Error:', error);

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

// Cleanup on process exit
process.on('exit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
