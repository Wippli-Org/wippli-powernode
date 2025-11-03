import { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeOneDriveConfig';

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  tenantId: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Failed to refresh access token');
  }

  return response.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    if (!POWERNODE_STORAGE_CONNECTION) {
      return res.status(500).json({ error: 'Storage connection not configured' });
    }

    // Retrieve OneDrive credentials from storage
    const tableClient = TableClient.fromConnectionString(POWERNODE_STORAGE_CONNECTION, TABLE_NAME);
    const entity = await tableClient.getEntity('default-user', 'onedrive-config');

    let accessToken = entity.accessToken as string;
    const refreshToken = entity.refreshToken as string;
    const expiresAt = entity.expiresAt as string;
    const clientId = entity.clientId as string;
    const clientSecret = entity.clientSecret as string;
    const tenantId = entity.tenantId as string;

    // Check if token is expired and refresh if needed
    if (new Date(expiresAt) <= new Date()) {
      console.log('OneDrive access token expired, refreshing...');
      const tokenData = await refreshAccessToken(clientId, clientSecret, refreshToken, tenantId);

      accessToken = tokenData.access_token;

      // Update the stored token
      const updatedEntity = {
        partitionKey: entity.partitionKey as string,
        rowKey: entity.rowKey as string,
        accessToken,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      };
      await tableClient.updateEntity(updatedEntity, 'Merge');
    }

    // Delete file from OneDrive
    const deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;

    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(errorData.error?.message || 'Failed to delete file from OneDrive');
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting OneDrive file:', error);

    if (error.statusCode === 404) {
      return res.status(400).json({ error: 'OneDrive credentials not configured or file not found' });
    }

    return res.status(500).json({
      error: error.message || 'Failed to delete OneDrive file',
    });
  }
}
