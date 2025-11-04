import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

/**
 * Individual Instance API
 *
 * GET    /api/instances/[id]    - Get specific instance
 * PUT    /api/instances/[id]    - Update instance
 * DELETE /api/instances/[id]    - Delete instance
 */

interface InstanceEntity {
  partitionKey: string;
  rowKey: string;
  instanceId: string;
  instanceName: string;
  supplierId?: string;
  n8nConfig?: string;
  subscriptionConfig?: string;
  authConfig?: string;
  storageConfig?: string;
  aiConfig?: string;
  adobeConfig?: string;
  uiConfig?: string;
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Instance ID is required' });
    }

    const tableClient = getTableClient();

    if (req.method === 'GET') {
      // Get specific instance
      // Try to find it across all partitions
      const filter = `RowKey eq '${id}'`;
      const entitiesIter = tableClient.listEntities({
        queryOptions: { filter }
      });

      let found = false;
      for await (const entity of entitiesIter) {
        found = true;
        return res.status(200).json({
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

      if (!found) {
        return res.status(404).json({ error: 'Instance not found' });
      }

    } else if (req.method === 'PUT') {
      // Update instance
      const config = req.body;

      // First, get the existing entity to know its partition key
      const filter = `RowKey eq '${id}'`;
      const entitiesIter = tableClient.listEntities({
        queryOptions: { filter }
      });

      let existingEntity: any = null;
      for await (const entity of entitiesIter) {
        existingEntity = entity;
        break;
      }

      if (!existingEntity) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const partitionKey = config.supplierId || existingEntity.partitionKey || 'default';
      const now = new Date();

      const entity: InstanceEntity = {
        partitionKey,
        rowKey: id,
        instanceId: id,
        instanceName: config.instanceName || existingEntity.instanceName,
        supplierId: config.supplierId || existingEntity.supplierId,
        n8nConfig: config.n8n ? JSON.stringify(config.n8n) : existingEntity.n8nConfig,
        subscriptionConfig: config.subscription ? JSON.stringify(config.subscription) : existingEntity.subscriptionConfig,
        authConfig: config.auth ? JSON.stringify(config.auth) : existingEntity.authConfig,
        storageConfig: config.storage ? JSON.stringify(config.storage) : existingEntity.storageConfig,
        aiConfig: config.ai ? JSON.stringify(config.ai) : existingEntity.aiConfig,
        adobeConfig: config.adobe ? JSON.stringify(config.adobe) : existingEntity.adobeConfig,
        uiConfig: config.ui ? JSON.stringify(config.ui) : existingEntity.uiConfig,
        createdAt: existingEntity.createdAt ? new Date(existingEntity.createdAt) : now,
        updatedAt: now,
      };

      // If partition key changed, delete old and create new
      if (partitionKey !== existingEntity.partitionKey) {
        await tableClient.deleteEntity(existingEntity.partitionKey, id);
        await tableClient.createEntity(entity);
      } else {
        await tableClient.updateEntity(entity, 'Merge');
      }

      return res.status(200).json({
        success: true,
        instance: {
          instanceId: entity.instanceId,
          instanceName: entity.instanceName,
          supplierId: entity.supplierId,
          updatedAt: entity.updatedAt,
        }
      });

    } else if (req.method === 'DELETE') {
      // Delete instance
      // First, find it to know its partition key
      const filter = `RowKey eq '${id}'`;
      const entitiesIter = tableClient.listEntities({
        queryOptions: { filter }
      });

      let found = false;
      for await (const entity of entitiesIter) {
        found = true;
        await tableClient.deleteEntity(entity.partitionKey as string, id);
        return res.status(200).json({
          success: true,
          message: 'Instance deleted'
        });
      }

      if (!found) {
        return res.status(404).json({ error: 'Instance not found' });
      }

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
