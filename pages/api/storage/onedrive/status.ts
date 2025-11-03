import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeOneDriveConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!POWERNODE_STORAGE_CONNECTION) {
      return res.status(200).json({
        connected: false,
        enabled: false,
        error: 'Storage connection not configured',
      });
    }

    // Check if OneDrive credentials exist for default-user
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);

    try {
      const entity = await tableClient.getEntity('default-user', 'onedrive-config');

      // Check if accessToken exists and is not expired
      const hasValidToken = !!(entity.accessToken as string);
      const isExpired = entity.expiresAt
        ? new Date(entity.expiresAt as string) <= new Date()
        : true;

      return res.status(200).json({
        connected: hasValidToken && !isExpired,
        enabled: hasValidToken,
        totalSize: null, // OneDrive doesn't have a fixed total size
        usedSize: 0, // Would need to call OneDrive API to get actual usage
        fileCount: 0, // Would need to call OneDrive API to count files
        tokenExpired: isExpired,
      });
    } catch (error: any) {
      // Entity not found - OneDrive not configured
      if (error.statusCode === 404) {
        return res.status(200).json({
          connected: false,
          enabled: false,
          error: 'OneDrive credentials not configured',
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error checking OneDrive status:', error);
    return res.status(500).json({
      connected: false,
      enabled: false,
      error: error.message || 'Failed to check OneDrive status',
    });
  }
}
