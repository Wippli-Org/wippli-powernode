import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient, AzureNamedKeyCredential } from '@azure/data-tables';

/**
 * Instance CRUD API
 *
 * GET    /api/instances              - List all instances (optionally filtered by supplierId)
 * POST   /api/instances              - Create new instance
 * GET    /api/instances/[id]         - Get specific instance
 * PUT    /api/instances/[id]         - Update instance
 * DELETE /api/instances/[id]         - Delete instance
 */

interface InstanceEntity {
  partitionKey: string;  // supplierId or 'default'
  rowKey: string;        // instanceId
  instanceId: string;
  instanceName: string;
  supplierId?: string;

  // n8n Configuration (stored as JSON strings)
  n8nConfig?: string;

  // Subscription & Auth (stored as JSON strings)
  subscriptionConfig?: string;
  authConfig?: string;

  // Storage, AI, Adobe configs (stored as JSON strings)
  storageConfig?: string;
  aiConfig?: string;
  adobeConfig?: string;

  // UI Configuration (stored as JSON string)
  uiConfig?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

function getTableClient(): TableClient {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING not configured');
  }

  return TableClient.fromConnectionString(
    connectionString,
    'PowerNodeInstances'
  );
}

async function ensureTableExists(client: TableClient) {
  try {
    await client.createTable();
  } catch (error: any) {
    // Table already exists, ignore error
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tableClient = getTableClient();
    await ensureTableExists(tableClient);

    if (req.method === 'GET') {
      // List instances, optionally filtered by supplierId
      const { supplierId } = req.query;

      let filter = '';
      if (supplierId && typeof supplierId === 'string') {
        filter = `PartitionKey eq '${supplierId}'`;
      }

      const instances = [];
      const entitiesIter = tableClient.listEntities({
        queryOptions: filter ? { filter } : undefined
      });

      for await (const entity of entitiesIter) {
        instances.push({
          instanceId: entity.instanceId,
          instanceName: entity.instanceName,
          supplierId: entity.supplierId,
          n8n: entity.n8nConfig ? JSON.parse(entity.n8nConfig as string) : undefined,
          subscription: entity.subscriptionConfig ? JSON.parse(entity.subscriptionConfig as string) : undefined,
          auth: entity.authConfig ? JSON.parse(entity.authConfig as string) : undefined,
          storage: entity.storageConfig ? JSON.parse(entity.storageConfig as string) : undefined,
          ai: entity.aiConfig ? JSON.parse(entity.aiConfig as string) : undefined,
          adobe: entity.adobeConfig ? JSON.parse(entity.adobeConfig as string) : undefined,
          ui: entity.uiConfig ? JSON.parse(entity.uiConfig as string) : undefined,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        });
      }

      return res.status(200).json({ instances });

    } else if (req.method === 'POST') {
      // Create new instance
      const config = req.body;

      if (!config.instanceId || !config.instanceName) {
        return res.status(400).json({
          error: 'instanceId and instanceName are required'
        });
      }

      const partitionKey = config.supplierId || 'default';
      const now = new Date();

      const entity: InstanceEntity = {
        partitionKey,
        rowKey: config.instanceId,
        instanceId: config.instanceId,
        instanceName: config.instanceName,
        supplierId: config.supplierId,
        n8nConfig: config.n8n ? JSON.stringify(config.n8n) : undefined,
        subscriptionConfig: config.subscription ? JSON.stringify(config.subscription) : undefined,
        authConfig: config.auth ? JSON.stringify(config.auth) : undefined,
        storageConfig: config.storage ? JSON.stringify(config.storage) : undefined,
        aiConfig: config.ai ? JSON.stringify(config.ai) : undefined,
        adobeConfig: config.adobe ? JSON.stringify(config.adobe) : undefined,
        uiConfig: config.ui ? JSON.stringify(config.ui) : undefined,
        createdAt: config.createdAt ? new Date(config.createdAt) : now,
        updatedAt: now,
      };

      await tableClient.createEntity(entity);

      return res.status(201).json({
        success: true,
        instance: {
          instanceId: entity.instanceId,
          instanceName: entity.instanceName,
          supplierId: entity.supplierId,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        }
      });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error: any) {
    console.error('Instance API error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
