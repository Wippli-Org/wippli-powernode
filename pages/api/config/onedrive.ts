import type { NextApiRequest, NextApiResponse } from 'next';
import { TableClient } from '@azure/data-tables';

const POWERNODE_STORAGE_CONNECTION =
  process.env.POWERNODE_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING || '';
const TABLE_NAME = 'powernodeOneDriveConfig';

interface OneDriveConfig {
  userId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
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
      console.error('Error creating OneDrive config table:', error);
    }
  }

  const userId = req.query.userId || req.body.userId || 'default-user';

  if (req.method === 'GET') {
    // Get OneDrive config for user
    try {
      const entity = await tableClient.getEntity(userId as string, 'onedrive-config');

      const config: OneDriveConfig = {
        userId: entity.partitionKey as string,
        tenantId: entity.tenantId as string,
        clientId: entity.clientId as string,
        clientSecret: entity.clientSecret as string,
        scopes: entity.scopes as string,
        accessToken: entity.accessToken as string | undefined,
        refreshToken: entity.refreshToken as string | undefined,
        expiresAt: entity.expiresAt as string | undefined,
        createdAt: entity.createdAt as string,
        updatedAt: entity.updatedAt as string,
      };

      return res.status(200).json({ config });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return res.status(404).json({ error: 'OneDrive config not found' });
      }
      console.error('Error fetching OneDrive config:', error);
      return res.status(500).json({ error: 'Failed to fetch OneDrive config' });
    }
  }

  if (req.method === 'POST') {
    // Create or update OneDrive config
    const { tenantId, clientId, clientSecret, scopes, accessToken, refreshToken, expiresAt } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    try {
      const now = new Date().toISOString();

      // Try to get existing config
      let existingConfig;
      try {
        existingConfig = await tableClient.getEntity(userId as string, 'onedrive-config');
      } catch (error: any) {
        if (error.statusCode !== 404) throw error;
      }

      const entity = {
        partitionKey: userId as string,
        rowKey: 'onedrive-config',
        tenantId,
        clientId,
        clientSecret,
        scopes: scopes || 'Files.ReadWrite offline_access User.Read',
        accessToken: accessToken || existingConfig?.accessToken || '',
        refreshToken: refreshToken || existingConfig?.refreshToken || '',
        expiresAt: expiresAt || existingConfig?.expiresAt || '',
        createdAt: existingConfig?.createdAt || now,
        updatedAt: now,
      };

      if (existingConfig) {
        await tableClient.updateEntity(entity, 'Merge');
      } else {
        await tableClient.createEntity(entity);
      }

      return res.status(200).json({
        success: true,
        config: {
          userId: entity.partitionKey,
          tenantId: entity.tenantId,
          clientId: entity.clientId,
          clientSecret: entity.clientSecret,
          scopes: entity.scopes,
          accessToken: entity.accessToken,
          refreshToken: entity.refreshToken,
          expiresAt: entity.expiresAt,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        },
      });
    } catch (error: any) {
      console.error('Error saving OneDrive config:', error);
      return res.status(500).json({ error: 'Failed to save OneDrive config' });
    }
  }

  if (req.method === 'DELETE') {
    // Delete OneDrive config
    try {
      await tableClient.deleteEntity(userId as string, 'onedrive-config');

      return res.status(200).json({
        success: true,
        message: 'OneDrive config deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting OneDrive config:', error);
      return res.status(500).json({ error: 'Failed to delete OneDrive config' });
    }
  }

  // New endpoint to exchange authorization code for tokens
  if (req.method === 'PUT' && req.query.action === 'token') {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'Missing authorization code or redirect URI' });
    }

    try {
      // Get existing config
      const entity = await tableClient.getEntity(userId as string, 'onedrive-config');

      const tenantId = entity.tenantId as string;
      const clientId = entity.clientId as string;
      const clientSecret = entity.clientSecret as string;
      const scopes = entity.scopes as string;

      // Exchange code for tokens
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: scopes,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange error:', errorText);
        return res.status(tokenResponse.status).json({
          error: 'Failed to exchange authorization code for tokens',
          details: errorText
        });
      }

      const tokenData = await tokenResponse.json();

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Update config with tokens
      const updatedEntity = {
        partitionKey: userId as string,
        rowKey: 'onedrive-config',
        tenantId,
        clientId,
        clientSecret,
        scopes,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        createdAt: entity.createdAt as string,
        updatedAt: new Date().toISOString(),
      };

      await tableClient.updateEntity(updatedEntity, 'Merge');

      return res.status(200).json({
        success: true,
        message: 'Tokens obtained successfully',
        expiresAt,
      });
    } catch (error: any) {
      console.error('Error exchanging authorization code:', error);
      return res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  }

  // Endpoint to refresh access token
  if (req.method === 'PUT' && req.query.action === 'refresh') {
    try {
      // Get existing config
      const entity = await tableClient.getEntity(userId as string, 'onedrive-config');

      const tenantId = entity.tenantId as string;
      const clientId = entity.clientId as string;
      const clientSecret = entity.clientSecret as string;
      const refreshToken = entity.refreshToken as string;
      const scopes = entity.scopes as string;

      if (!refreshToken) {
        return res.status(400).json({ error: 'No refresh token available' });
      }

      // Refresh access token
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: scopes,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh error:', errorText);
        return res.status(tokenResponse.status).json({
          error: 'Failed to refresh access token',
          details: errorText
        });
      }

      const tokenData = await tokenResponse.json();

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Update config with new tokens
      const updatedEntity = {
        partitionKey: userId as string,
        rowKey: 'onedrive-config',
        tenantId,
        clientId,
        clientSecret,
        scopes,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
        expiresAt,
        createdAt: entity.createdAt as string,
        updatedAt: new Date().toISOString(),
      };

      await tableClient.updateEntity(updatedEntity, 'Merge');

      return res.status(200).json({
        success: true,
        message: 'Access token refreshed successfully',
        expiresAt,
      });
    } catch (error: any) {
      console.error('Error refreshing access token:', error);
      return res.status(500).json({ error: 'Failed to refresh access token' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
