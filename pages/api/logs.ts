import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const LOGS_TABLE_NAME = 'powernodeexecutionlogs';

interface LogEntry {
  partitionKey: string; // executionId or 'system'
  rowKey: string; // timestamp_sequence
  timestamp: string;
  executionId: string;
  wippliId?: number;
  creatorId?: string;
  tool?: string;
  level: 'info' | 'error' | 'warning' | 'success';
  message: string;
  data?: string; // JSON string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!POWERNODE_STORAGE_CONNECTION) {
    // Return mock logs if no storage configured
    return res.status(200).json({
      logs: getMockLogs(),
      message: 'Using mock data (storage not configured)',
    });
  }

  try {
    const tableClient = TableClient.fromConnectionString(
      POWERNODE_STORAGE_CONNECTION,
      LOGS_TABLE_NAME
    );

    // Get query parameters
    const limit = parseInt(req.query.limit as string) || 100;
    const executionId = req.query.executionId as string;
    const level = req.query.level as string;

    // Ensure table exists
    await tableClient.createTable().catch(() => {
      // Ignore if already exists
    });

    // Query logs
    let query = '';
    if (executionId) {
      query = `PartitionKey eq '${executionId}'`;
    }
    if (level) {
      const levelFilter = `level eq '${level}'`;
      query = query ? `${query} and ${levelFilter}` : levelFilter;
    }

    const entities = tableClient.listEntities<LogEntry>({
      queryOptions: query ? { filter: query } : undefined,
    });

    const logs: any[] = [];
    for await (const entity of entities) {
      if (logs.length >= limit) break;

      logs.push({
        timestamp: entity.timestamp,
        executionId: entity.executionId || entity.partitionKey,
        wippliId: entity.wippliId,
        creatorId: entity.creatorId || 'unknown',
        tool: entity.tool || 'system',
        level: entity.level || 'info',
        message: entity.message || '',
        data: entity.data ? JSON.parse(entity.data as string) : undefined,
      });
    }

    // Sort by timestamp descending (most recent first)
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // If no logs found, return mock logs for demo
    if (logs.length === 0) {
      return res.status(200).json({
        logs: getMockLogs(),
        message: 'No logs found in storage, showing demo data',
      });
    }

    return res.status(200).json({
      logs,
      count: logs.length,
      limit,
    });
  } catch (error: any) {
    console.error('Logs API error:', error);

    // Return mock logs on error
    return res.status(200).json({
      logs: getMockLogs(),
      message: 'Using mock data (error accessing storage)',
      error: error.message,
    });
  }
}

/**
 * Mock logs for demo/testing
 */
function getMockLogs() {
  const now = new Date();
  const logs = [];

  // Generate some realistic mock logs
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - i * 10000).toISOString();
    const tools = [
      'download_wippli_file',
      'query_vector_database',
      'populate_document_template',
      'convert_to_pdf',
      'post_wippli_comment',
    ];
    const levels: Array<'info' | 'success' | 'warning' | 'error'> = [
      'info',
      'info',
      'info',
      'success',
      'warning',
      'error',
    ];
    const tool = tools[i % tools.length];
    const level = levels[i % levels.length];

    const messages = {
      info: `Executing ${tool} for wippli 337`,
      success: `Successfully completed ${tool} in 2.3s`,
      warning: `${tool} slow response (5.2s)`,
      error: `${tool} failed: API rate limit exceeded`,
    };

    logs.push({
      timestamp,
      executionId: `exec_${Math.random().toString(36).substring(7)}`,
      wippliId: 337,
      creatorId: 'prologistik_admin',
      tool,
      level,
      message: messages[level],
      data:
        level === 'error'
          ? {
              error: 'RateLimitError',
              retryAfter: 60,
              requestId: 'req_xyz123',
            }
          : undefined,
    });
  }

  return logs;
}
