import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeInstances';

export interface InstanceConfig {
  instanceId: string;
  instanceName: string;
  userId?: string;
  wippliId?: string;
  n8n?: {
    apiUrl: string;
    apiKey: string;
    enabled: boolean;
  };
  storage?: {
    azureConnectionString?: string;
    containerName?: string;
    tableName?: string;
  };
  ai?: {
    anthropicApiKey?: string;
    defaultModel?: string;
  };
  adobe?: {
    clientId?: string;
    clientSecret?: string;
  };
  ui?: {
    theme?: 'light' | 'dark';
    hideNavigation?: boolean;
    enabledPages?: string[];
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // User who created this instance
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!POWERNODE_STORAGE_CONNECTION) {
    return res.status(500).json({ error: 'Storage connection not configured' });
  }

  const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

  // Ensure table exists
  try {
    await tableClient.createTable();
  } catch (error: any) {
    if (error.statusCode !== 409) {
      console.error('Error creating table:', error);
    }
  }

  // Get userId from query params or auth header (future: from JWT token)
  const userId = req.query.userId || req.body.userId || req.headers['x-user-id'] || 'default-user';

  if (req.method === 'GET') {
    // Get all instances for a user, or get specific instance by ID
    const instanceId = req.query.instanceId as string | undefined;

    try {
      if (instanceId) {
        // Get specific instance
        const entity = await tableClient.getEntity(userId as string, instanceId);
        const instance = entityToInstance(entity);
        return res.status(200).json({ instance });
      } else {
        // Get all instances for user
        const entities = tableClient.listEntities({
          queryOptions: { filter: `PartitionKey eq '${userId}'` },
        });

        const instances: InstanceConfig[] = [];
        for await (const entity of entities) {
          instances.push(entityToInstance(entity));
        }

        // Sort by updatedAt descending
        instances.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        return res.status(200).json({ instances });
      }
    } catch (error: any) {
      console.error('Error fetching instances:', error);
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch instances' });
    }
  }

  if (req.method === 'POST') {
    // Create new instance
    const {
      instanceName,
      wippliId,
      n8n,
      storage,
      ai,
      adobe,
      ui,
    } = req.body;

    if (!instanceName) {
      return res.status(400).json({ error: 'Instance name required' });
    }

    try {
      const now = new Date().toISOString();
      const instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const entity = {
        partitionKey: userId as string,
        rowKey: instanceId,
        instanceName,
        wippliId: wippliId || '',
        n8nConfig: n8n ? JSON.stringify(n8n) : '',
        storageConfig: storage ? JSON.stringify(storage) : '',
        aiConfig: ai ? JSON.stringify(ai) : '',
        adobeConfig: adobe ? JSON.stringify(adobe) : '',
        uiConfig: ui ? JSON.stringify(ui) : '',
        createdAt: now,
        updatedAt: now,
        createdBy: userId as string,
      };

      await tableClient.createEntity(entity);

      const instance: InstanceConfig = {
        instanceId,
        instanceName,
        userId: userId as string,
        wippliId,
        n8n,
        storage,
        ai,
        adobe,
        ui,
        createdAt: now,
        updatedAt: now,
        createdBy: userId as string,
      };

      return res.status(201).json({
        success: true,
        instance,
      });
    } catch (error: any) {
      console.error('Error creating instance:', error);
      return res.status(500).json({ error: 'Failed to create instance' });
    }
  }

  if (req.method === 'PUT') {
    // Update existing instance
    const {
      instanceId,
      instanceName,
      wippliId,
      n8n,
      storage,
      ai,
      adobe,
      ui,
    } = req.body;

    if (!instanceId) {
      return res.status(400).json({ error: 'Instance ID required' });
    }

    try {
      // Check if instance exists and belongs to user
      let existingEntity;
      try {
        existingEntity = await tableClient.getEntity(userId as string, instanceId);
      } catch (error: any) {
        if (error.statusCode === 404) {
          return res.status(404).json({ error: 'Instance not found' });
        }
        throw error;
      }

      const now = new Date().toISOString();

      const entity = {
        partitionKey: userId as string,
        rowKey: instanceId,
        instanceName: instanceName || existingEntity.instanceName,
        wippliId: wippliId !== undefined ? wippliId : existingEntity.wippliId,
        n8nConfig: n8n !== undefined ? JSON.stringify(n8n) : existingEntity.n8nConfig,
        storageConfig: storage !== undefined ? JSON.stringify(storage) : existingEntity.storageConfig,
        aiConfig: ai !== undefined ? JSON.stringify(ai) : existingEntity.aiConfig,
        adobeConfig: adobe !== undefined ? JSON.stringify(adobe) : existingEntity.adobeConfig,
        uiConfig: ui !== undefined ? JSON.stringify(ui) : existingEntity.uiConfig,
        createdAt: existingEntity.createdAt,
        updatedAt: now,
        createdBy: existingEntity.createdBy,
      };

      await tableClient.updateEntity(entity, 'Merge');

      return res.status(200).json({
        success: true,
        message: 'Instance updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating instance:', error);
      return res.status(500).json({ error: 'Failed to update instance' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete instance
    const { instanceId } = req.body;

    if (!instanceId) {
      return res.status(400).json({ error: 'Instance ID required' });
    }

    try {
      await tableClient.deleteEntity(userId as string, instanceId);

      return res.status(200).json({
        success: true,
        message: 'Instance deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting instance:', error);
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      return res.status(500).json({ error: 'Failed to delete instance' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper function to convert table entity to InstanceConfig
function entityToInstance(entity: any): InstanceConfig {
  return {
    instanceId: entity.rowKey,
    instanceName: entity.instanceName,
    userId: entity.partitionKey,
    wippliId: entity.wippliId || undefined,
    n8n: entity.n8nConfig ? JSON.parse(entity.n8nConfig) : undefined,
    storage: entity.storageConfig ? JSON.parse(entity.storageConfig) : undefined,
    ai: entity.aiConfig ? JSON.parse(entity.aiConfig) : undefined,
    adobe: entity.adobeConfig ? JSON.parse(entity.adobeConfig) : undefined,
    ui: entity.uiConfig ? JSON.parse(entity.uiConfig) : undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    createdBy: entity.createdBy,
  };
}
